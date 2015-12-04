/**
 * Channel can be used for cross process communication, in two modes:
 *
 *   - provider and query mode: a process can query all pairs for a data, with a channel name
 *   - dispatcher and listener mode: a process can dispatch a message to all pairs, with a channel name
 *
 * @example
 *
 *     import * as channel from '../src/module/channel';
 *
 *     channel.registerProvider('get_pid', function () {
 *         return process.pid
 *     });
 *
 *     channel.registerListener('notify', function (data) {
 *         console.log('received notify', data)
 *     });
 *
 *     setInterval(function () {
 *         co.run(function () {
 *             console.log(process.pid, channel.query('get_pid'));
 *             channel.dispatch('notify', Math.random())
 *         }).done();
 *     }, 3000);
 *
 * @title cross process message gathering and dispatching system
 */


const isSlave = !!process.send;
const providers = {}; // ch=>cb
const listeners = {}; // ch=>cb

if (isSlave) { // ipc enabled
    process.send({action: 'setup', module: 'channel'});
    process.on('message', onMasterMessage)
}


/**
 * register a provider for [query](#query). when called by one child, all pairs will be queried and the result
 * is returned as an array.
 *
 * `cb` is called inside coroutine if `direct` is set to false
 *
 * @param {string} ch channel name to be queried
 * @param {function} cb callback method to get the data
 * @param {boolean} direct whether cb should run directly or inside coroutine, default to false
 */
export function registerProvider(ch, cb, direct) {
    providers[ch] = [cb, direct];
}

/**
 * register a listener to dispatch
 *
 * `cb` is called outside coroutine
 *
 * @param {string} ch channel name that listens to
 * @param {function} cb callback method receive the dispatched data
 */
export function registerListener(ch, cb) {
    if (ch in listeners) {
        let curr = listeners[ch];
        if ('push' in curr) {
            curr.push(cb);
        } else {
            const callbacks = [curr, cb];
            let L = 2;

            listeners[ch] = dispatcher;
            dispatcher.push = function (cb) {
                return L = callbacks.push(cb);
            };
            function dispatcher() {
                for (let i = 0; i < L; i++) {
                    callbacks[i].apply(this, arguments);
                }
            }
        }
    } else {
        listeners[ch] = cb;
    }
}

let nextSeq = 1;

/**
 * query all processes, get the data by the provider registered, and return them as an array
 * @param {string} ch channel name to be queried
 * @returns {Array} all results of the pairs that registered a provider for this channel
 */
export function query(ch) {
    let results = isSlave ? process.sendAndWait({
        action: 'channel',
        cmd: 'query',
        channel: ch
    }) : [];
    if (ch in providers) {
        results.push(providers[ch][0]());
    }
    return results;
}

/**
 * dispatch a message to all processes
 * @param {string} ch channel to be dispatched
 * @param data data to be dispatched, must be json serializable
 */
export function dispatch(ch, data) {
    if (isSlave) {
        process.send({
            action: 'channel',
            cmd: 'dispatch',
            channel: ch,
            data: data
        })
    }
    if (ch in listeners) {
        listeners[ch](data);
    }
}

const waitingQueries = {};

export function onMessage(mesg) {
    // outside fiber
    let cmd = mesg.cmd;
    if (cmd === 'query') {
        const worker = this;
        const results = [], seq = mesg.seq = nextSeq++;
        // send to all pairs
        let waiting = dispatchToPairs(worker, mesg);

        // no pairs waited
        if (!waiting) {
            return results;
        }
        return co.promise(function (resolve) {
            // wait for pairs
            const timer = setTimeout(respond, 400);
            waitingQueries[seq] = function (mesg) {
                if (mesg.status === 0) results.push(mesg.result);
                if (!--waiting) {
                    clearTimeout(timer);
                    respond();
                }
            };
            function respond() {
                delete waitingQueries[seq];
                resolve(results);
            }
        });
    } else if (cmd === 'queryback') {
        let cb = waitingQueries[mesg.ack];
        cb && cb(mesg);
    } else if (cmd === 'dispatch') {
        dispatchToPairs(this, mesg);
    }
}

function dispatchToPairs(worker, mesg) {
    let dispatched = 0;
    for (let pair of worker.program.workers) {
        if (pair !== worker) {
            try {
                pair && pair.send(mesg);
                dispatched++;
            } catch (e) {
                console.error('channel.js::Master::dispatch: pair shutdown');
            }
        }
    }
    return dispatched;
}

function onMasterMessage(mesg) {
    if (!mesg || mesg.action !== 'channel') return;
    let cmd = mesg.cmd;
    if (cmd === 'query') {
        let ch = mesg.channel, resp = {
            action: 'channel',
            cmd: 'queryback',
            status: 1,
            ack: mesg.seq
        };
        if (ch in providers) {
            let provider = providers[ch];
            if (provider[1]) { // directly
                resp.status = 0;
                resp.result = provider[0]();
                process.send(resp);
            } else { // inside coroutine
                co.run(provider[0]).then(function (result) { // success
                    resp.status = 0;
                    resp.result = result;
                    process.send(resp);
                }, function () { // failed
                    process.send(resp);
                });
            }
        } else {
            process.send(resp);
        }
    } else if (cmd === 'dispatch') {
        let ch = mesg.channel;
        if (ch in listeners) {
            listeners[ch](mesg.data);
        }
    }
}
