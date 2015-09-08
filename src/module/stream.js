/**
 * @title utils for
 */

/**
 *
 * @param incoming
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

