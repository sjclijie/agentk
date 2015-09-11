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
        let bufs = [];
        incoming.on('data', function (data) {
            bufs.push(data);
        }).on('end', function () {
            resolve(Buffer.concat(bufs));
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

