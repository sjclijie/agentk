const _extend = require('util')._extend,
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
        assert(this.key in worker.handles, 'worker does not contain this handle');

        delete worker.handles[this.key];
        if (--this.workers) return;
        // free handle
        this.handle.close();
        this.handle = null;
        delete this.schedulers[this.key];
        console.log(datetime() + ' scheduler.js: closing Handle %s', this.key);
    }


    send(worker, seq, errno, handle, data) {
        worker.send(_extend({
            cmd: 'NODE_CLUSTER',
            key: this.key,
            errno: errno,
            ack: seq,
            data: this.data
        }, data), handle)
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
        this.send(worker, seq, this.errno, this.handle);
    }

}

class RoundRobinHandle extends Handle {
    constructor(schedulers, key, option) {
        super(schedulers, key);
        let workers = this.free = [];
        let connections = this.handles = [];
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

        const self = this;

        let pendingWorkers = [];

        // when listening is not triggered, just add workers to pendingWorkers
        self.add = pendingWorkers.push.bind(pendingWorkers);
        self.onWorker = onWorker;

        server.once('listening', function () {
            let handle = self.handle = server._handle;
            handle.onconnection = onConnection;
            if (handle.getsockname) {
                handle.getsockname((self._extra || (self._extra = {})).sockname = {});
            }
            sendToPendingWorkers(0, null, self._extra);
            self.workers = workers.length;
        });

        server.once('error', function (err) {
            sendToPendingWorkers(process.binding('uv')['UV_' + err.errno]);
        });

        function sendToPendingWorkers(errno, handle, data) {
            for (let i = 0, L = pendingWorkers.length; i < L; i += 2) {
                let worker = pendingWorkers[i], seq = pendingWorkers[i + 1];
                let succ = !errno;
                try {
                    self.send(worker, seq, errno, handle, data);
                } catch (e) { // an early death could kill the daemon
                    succ = false;
                }
                if (succ) {
                    worker.handles[key] = true;
                    workers.push(worker);
                }
            }
            pendingWorkers = null;
            delete self.add;
            if (!workers.length) { // no workers available, maybe errno is TRUE or all pending workers are dead
                if (!errno) server.close();
                delete schedulers[key];
            }
        }

        function onConnection(err, handle) {
            if (workers.length) {
                dispatch(handle, workers.shift());
            } else {
                connections.push(handle);
            }
        }

        function onWorker(worker) {
            if (connections.length) {
                dispatch(connections.shift(), worker);
            } else {
                workers.push(worker);
            }

        }

        function dispatch(handle, worker) {
            const seq = sendSeq++;
            try {
                self.send(worker, undefined, null, handle, {act: 'newconn', seq: seq});
            } catch (e) { // worker maybe dead
                console.error(datetime() + ' scheduler.js: handle dispatch failed: ' + (err.stack || err.message || err));
                delete worker.handles[key];
                onConnection(0, handle);
                return;
            }
            let acceptTimer = setTimeout(function () {
                // worker does not accept or reject, maybe already dead?
                delete pendingMessages[seq];
                onConnection(0, handle);
            }, 2000);
            pendingMessages[seq] = function (reply) {
                clearTimeout(acceptTimer);
                if (reply.accepted) {
                    // master closes handle, client keeps handle
                    handle.close();
                } else {
                    onConnection(0, handle);  // Worker is shutting down. Send to another.
                }
                onWorker(worker);
            };
        }
    }

    add(worker, seq) {
        this.send(worker, seq, null, null, this._extra);
        this.workers++;
        worker.handles[this.key] = true;
        this.onWorker(worker);  // In case there are connections pending.
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

const defaultHandle = process.env.NODE_CLUSTER_SCHED_POLICY === 'none' ? SharedHandle
    : process.env.NODE_CLUSTER_SCHED_POLICY === 'rr' ? RoundRobinHandle
    : process.platform === 'win32' ? SharedHandle : RoundRobinHandle;

function workerOnMessage(message) {
    if (!message || message.cmd !== 'NODE_CLUSTER') return;
    if ('ack' in message) {
        let cb = pendingMessages[message.ack];
        if (cb) {
            cb(message);
            delete pendingMessages[message.ack];
        }
        return;
    }
    const worker = this, handles = worker.handles, schedulers = worker.program.schedulers;


    if (message.act === 'queryServer') {
        let key = [message.address,
            message.port,
            message.addressType,
            message.fd].join(':');

        if (key in handles) {
            schedulers[key].send(worker, message.seq, EADDRINUSE);
            return;
        }

        if (key in schedulers) {
            schedulers[key].add(worker, message.seq);
            return;
        }

        let Scheduler = message.addressType === 'udp4' || message.addressType === 'udp6' ? SharedHandle : defaultHandle;

        console.log(datetime() + ' scheduler.js: creating Scheduler %s %s', key, Scheduler.name);
        let handle = new Scheduler(schedulers, key, message);

        if (!handle.data) handle.data = message.data;
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

const timeOff = new Date().getTimezoneOffset() * 60e3;

function datetime() {
    return new Date(Date.now() - timeOff).toJSON().substr(0, 23);
}