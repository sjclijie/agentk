const util = require('util'),
    net = require('net'),
    assert = require('assert');

let ids = 0;

const EADDRINUSE = process.binding('uv')['UV_EADDRINUSE'];


let sendSeq = 0;
const pendingMessages = {};

class Handle {
    constructor(schedulers, key) {
        this.schedulers = schedulers;
        schedulers[key] = this;
        this.key = key;
        this.workers = 0;
        this.handle = null;
    }

    remove(worker) {
        if (!(this.key in worker.handles)) {
            throw new Error('worker does not contain this handle');
        }
        delete worker.handles[this.key];
        if (--this.workers) return;
        // free handle
        this.handle.close();
        this.handle = null;
        delete this.schedulers[this.key];
        console.log('scheduler.js: closing Handle %s', this.key);
    }

}

class SharedHandle extends Handle {
    constructor(schedulers, key, option) {
        super(schedulers, key);
        this.errno = 0;

        let rval;
        if (option.addressType === 'udp4' || option.addressType === 'udp6')
            rval = dgram._createSocketHandle(option.address, option.port, option.addressType, option.fd, option.flags);
        else
            rval = net._createServerHandle(option.address, option.port, option.addressType, option.fd);

        if (typeof rval === 'number')
            this.errno = rval;
        else
            this.handle = rval;
    }

    add(worker, seq) {
        this.workers++;
        worker.handles[this.key] = true;
        send(worker, seq, this.key, this.errno, this.handle);
    }

}

class RoundRobinHandle extends Handle {
    constructor(schedulers, key, option) {
        super(schedulers, key);
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

        // when listening is not triggered, just add workers to pendingWorkers
        this.add = pendingWorkers.push.bind(pendingWorkers);
        self.distribute = distribute;
        self.handoff = handoff;

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
                    worker.handles[key] = true;
                }
            }
            pendingWorkers = null;
        }

        function distribute(err, handle) {
            handles.push(handle);
            if (frees.length) self.handoff(frees.pop());
        }

        function handoff(worker) {
            if (!(key in worker.handles)) return;

            if (!handles.length) {
                frees.push(worker);  // Add to ready queue again.
                return;
            }
            let handle = handles.shift();
            const seq = sendSeq++;
            send(worker, undefined, key, null, handle, {act: 'newconn', seq: seq});
            pendingMessages[seq] = function (reply) {
                if (reply.accepted) {
                    // master closes handle, client keeps handle
                    handle.close();
                } else {
                    self.distribute(0, handle);  // Worker is shutting down. Send to another.
                }
                self.handoff(worker);
            };
        }
    }

    add(worker, seq) {
        send(worker, seq, this.key, null, null, this.data);
        this.workers++;
        worker.handles[this.key] = true;
        this.handoff(worker);  // In case there are connections pending.
    }


    remove(worker) {
        super.remove(worker);
        var index = this.free.indexOf(worker);
        if (index !== -1) this.free.splice(index, 1);
        if (this.workers) return;

        for (let handle of this.handles) { // close pending connections
            handle.close();
        }
        this.handles.length = 0;
    }

}

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


const defaultHandle = process.env.NODE_CLUSTER_SCHED_POLICY === 'none' ? SharedHandle
    : process.env.NODE_CLUSTER_SCHED_POLICY === 'rr' ? RoundRobinHandle
    : process.platform === 'win32' ? SharedHandle : RoundRobinHandle;

function workerOnMessage(message) {
    if (!message || message.cmd !== 'NODE_CLUSTER') return;
    if ('ack' in message) {
        pendingMessages[message.ack](message);
        delete pendingMessages[message.ack];
        return;
    }
    const worker = this, handles = worker.handles, schedulers = worker.program.schedulers;


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

        let Scheduler = message.addressType === 'udp4' || message.addressType === 'udp6' ? SharedHandle : defaultHandle;

        console.log('scheduler.js: creating Scheduler %s %s', key, Scheduler.name);
        let handle = new Scheduler(schedulers, key, message);

        handle.add(worker, message.seq);
    } else if (message.act === 'close') {
        schedulers[message.key].remove(worker);
        delete handles[message.key];
    }
}

function workerOnExit() {
    const schedulers = this.program.schedulers;
    for (let key in this.handles) {
        schedulers[key].remove(this);
    }
}

export function onWorker(worker) {
    worker.handles = {__proto__: null};
    worker.on('internalMessage', workerOnMessage);
    worker.on('exit', workerOnExit);
}