/**
 * @title utils for stream consumption
 */

/**
 * Read stream's contents
 *
 * @example
 *     let incoming = http.request(...);
 *     let content = stream.read(incoming);
 *
 * @param {node.stream::stream.Readable} incoming stream to be read
 * @returns {Buffer} contents read
 */
export function read(incoming) {
    return co.promise(function (resolve, reject) {
        let bufs = [], totalLen = 0;
        incoming.on('data', function (data) {
            totalLen += data.length;
            bufs.push(data);
        }).once('end', function () {
            resolve(Buffer.concat(bufs, totalLen));
        })
    })
}

const stream_iterator = {};
stream_iterator[Symbol.iterator] = function () {
    return this;
};


/**
 * Create an iterator which yields when stream has contents available
 *
 * @example
 *     let incoming = ...;
 *     for(let buf of stream.iterator(incoming)) {
 *         ...
 *     }
 *
 * @param {node.stream::stream.Readable} incoming
 * @returns {Iterator} iterator which can be used in for...of
 */
export function iterator(incoming) {
    return {
        __proto__: stream_iterator,
        next: function () {
            this.next = next;
            let buffers = [], pending = null, resolve = push, done = false;
            incoming.on('data', function (data) {
                resolve({done: false, value: data});
            }).on('end', function () {
                done = true;
                resolve({done: true});
            });

            return next();
            function next() {
                if (pending) {
                    return co.yield(pending);
                }
                if (buffers.length) {
                    return buffers.shift();
                }
                if (done) {
                    return {done: true}
                }
                return co.yield(pending = new Promise(function (_resolve) {
                    if (buffers.length) {
                        pending = null;
                        _resolve(buffers.shift());
                    } else if (done) {
                        pending = null;
                        _resolve({done: true})
                    } else {
                        resolve = function (obj) {
                            pending = null;
                            resolve = push;
                            _resolve(obj);
                        }
                    }
                }))
            }

            function push(buf) {
                buffers.push(buf);
            }
        }
    };
}

const SlowBuffer = require('buffer').SlowBuffer;

export class Input {
    constructor(stream) {
        let available = 0;
        let buf = this._buf = new Buffer(0);
        const pending = [], self = this;

        stream.on('data', function (data) {
            // console.log('recv', data.length, available, data);
            const unread = self._buf;
            if (!unread.length) { // no bytes left
                buf = self._buf = data;
                available = 0;
            } else {
                let bufEnd = buf.length - available;
                if (available < data.length) {
                    const required = unread.length + data.length,
                        newCapacity = required < 4096 ? 4096 : 1 << 32 - Math.clz32(required),
                        newBuf = new SlowBuffer(newCapacity);
                    unread.copy(newBuf, 0);
                    bufEnd = unread.length;
                    buf = newBuf;
                    available = newCapacity - bufEnd;
                }
                data.copy(buf, bufEnd);
                self._buf = buf.slice(bufEnd - unread.length, bufEnd + data.length);
                available -= data.length;
            }
            for (; ;) {
                if (!pending.length) {
                    stream.pause();
                    break;
                }
                const resolver = pending[0];

                if (self._buf.length < resolver.required) {
                    break;
                }
                pending.shift();
                resolver.resolve();
            }
        }).once('error', onerror).once('close', function () {
            onerror(new Error('socket closed'))
        });
        stream.pause();

        function onerror(err) {
            self._buf = {
                get length() {
                    throw new Error('socket closed')
                }
            };
            for (let resolver of pending) {
                resolver.reject(err);
            }
            pending.length = 0;
        }

        this._wait = function (length) {
            co.promise(function (resolve, reject) {
                pending.push({required: length, resolve, reject});
                pending.length === 1 && stream.resume();
            })
        }
    }

    available() {
        return this._buf.length;
    }

    read(length) {
        let buf = this._buf;
        if (buf.length < length) {
            this._wait(length);
        }
        buf = this._buf;
        this._buf = buf.slice(length);
        return buf.slice(0, length);
    }

    readLine() {
        for (let start = 0; ;) {
            const buf = this._buf;
            const idx = buf.length && Array.prototype.indexOf.call(buf, 10, start) + 1;
            if (!idx) {
                start = buf.length;
                this._wait(start + 1);
                continue;
            }
            this._buf = buf.slice(idx);
            return buf.slice(0, idx)
        }
    }
}