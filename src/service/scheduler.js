const util = require('util'),
    net = require('net'),
    assert = require('assert');

let ids = 0;
const defaultScheduler = process.env.NODE_CLUSTER_SCHED_POLICY === 'none' ? SharedScheduler
    : process.env.NODE_CLUSTER_SCHED_POLICY === 'rr' ? RoundRobinScheduler
    : process.platform === 'win32' ? SharedScheduler : RoundRobinScheduler;

const EADDRINUSE = process.binding('uv')['UV_EADDRINUSE'];

function SharedScheduler(schedulers, key, option) {
    this.schedulers = schedulers;
    schedulers[key] = this;
    this.key = key;
    this.workers = 0;
    this.handle = null;
    this.errno = 0;

    var rval;
    if (option.addressType === 'udp4' || option.addressType === 'udp6')
        rval = dgram._createSocketHandle(option.address, option.port, option.addressType, option.fd);
    else
        rval = net._createServerHandle(option.address, option.port, option.addressType, option.fd);

    if (util.isNumber(rval))
        this.errno = rval;
    else
        this.handle = rval;
}

SharedScheduler.prototype.add = function (worker, seq) {
    this.workers++;
    worker.sched.handles[this.key] = true;
    send(worker, seq, this.key, this.errno, this.handle);
};

SharedScheduler.prototype.remove = function () {
    if (--this.workers) return;

    this.handle.close();
    this.handle = null;
    delete this.schedulers[this.key];
    console.log('closing RoundRobinScheduler', this.key);
};


function RoundRobinScheduler(schedulers, key, option) {
    this.schedulers = schedulers;
    schedulers[key] = this;
    this.key = key;
    let frees = this.free = [];
    let handles = this.handles = [];
    this.handle = null;
    this.data = null;
    this.workers = 0;

    let server = net.createServer(assert.fail);


    if (option.fd >= 0)
        server.listen({fd: option.fd});
    else if (option.port >= 0)
        server.listen(option.port, option.address);
    else
        server.listen(option.address);  // UNIX socket path.

    var self = this;

    let pendingWorkers = [];
    this.add = pendingWorkers.push.bind(pendingWorkers);

    server.once('listening', function () {
        delete self.add;
        let handle = self.handle = server._handle;
        handle.onconnection = distribute;
        if (handle.getsockname) {
            let data = {};
            self.data = {sockname: data};
            handle.getsockname(data);
        }
        sendAll(0, null, self.data);
        self.workers = frees.length;
    });

    server.once('error', function (err) {
        let errno = process.binding('uv')['UV_' + err.errno];
        sendAll(errno);
        delete self.schedulers[key];
    });

    function sendAll(errno, handle, data) {
        for (let i = 0, L = pendingWorkers.length; i < L; i += 2) {
            let worker = pendingWorkers[i];
            send(worker, pendingWorkers[i + 1], key, errno, handle, data);
            if (!errno) {
                frees.push(worker);
                worker.sched.handles[key] = true;
            }
        }
        pendingWorkers = null;
    }

    function distribute(err, handle) {
        handles.push(handle);
        if (frees.length) self.handoff(frees.pop());
    }
}

RoundRobinScheduler.prototype.add = function (worker, seq) {
    send(worker, seq, this.key, null, null, this.data);
    this.workers++;
    worker.sched.handles[this.key] = true;
    this.handoff(worker);  // In case there are connections pending.
};

RoundRobinScheduler.prototype.remove = function (worker) {
    var index = this.free.indexOf(worker);
    if (index !== -1) this.free.splice(index, 1);
    if (--this.workers) return;

    delete this.schedulers[this.key];
    for (let handle of this.handles) {
        handle.close();
    }
    this.handle.close();
    this.handle = null;
    console.log('closing RoundRobinScheduler', this.key);
};

let sendSeq = 0;
const pendingMessages = {};

RoundRobinScheduler.prototype.handoff = function (worker) {
    if (!(this.key in worker.sched.handles)) return;

    if (!this.handles.length) {
        this.free.push(worker);  // Add to ready queue again.
        return;
    }
    var handle = this.handles.shift();
    var self = this;
    let seq = sendSeq++;
    send(worker, undefined, this.key, null, handle, {act: 'newconn', seq: seq});
    pendingMessages[seq] = function (reply) {
        if (reply.accepted)
            handle.close();
        else
            self.distribute(0, handle);  // Worker is shutting down. Send to another.
        self.handoff(worker);
    };
};

function send(worker, seq, key, errno, handle, data, cb) {
    data = util._extend({
        cmd: 'NODE_CLUSTER',
        key: key,
        errno: errno,
        ack: seq
    }, data);
    if (cb) {
        pendingMessages[data.seq = sendSeq++] = cb;
    }
    worker.send(data, handle)
}

function workerOnMessage(message) {
    if (!message || message.cmd !== 'NODE_CLUSTER') return;
    if ('ack' in message) {
        pendingMessages[message.ack](message);
        delete pendingMessages[message.ack];
        return;
    }
    let worker = this, handles = worker.sched.handles, schedulers = worker.sched.schedulers;


    if (message.act === 'queryServer') {
        let key = [message.address,
            message.port,
            message.addressType,
            message.fd].join(':');

        if (key in handles) {
            send(worker, message.seq, key, EADDRINUSE);
            return;
        }

        if (key in schedulers) {
            schedulers[key].add(worker, message.seq);
            return;
        }

        let Scheduler = message.addressType === 'udp4' || message.addressType === 'udp6' ? SharedScheduler : defaultScheduler;

        let handle = new Scheduler(schedulers, key, message);

        handle.add(worker, message.seq);
    } else if (message.act === 'close') {
        schedulers[message.key].remove(worker);
        delete handles[message.key];
    }
}
function workerOnExit() {
    for (let key in this.sched.handles) {
        this.sched.schedulers[key].remove(this);
    }
}

export function onWorker(worker, program) {
    worker.sched = {
        schedulers: program.schedulers,
        handles: {__proto__: null}
    };
    worker.on('internalMessage', workerOnMessage);
    worker.on('exit', workerOnExit);
}