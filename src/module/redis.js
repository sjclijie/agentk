/**
 * @title Redis Client
 */

const _net = require('net');
const SlowBuffer = require('buffer').SlowBuffer;
const CONNECT = 'connect', AUTH = 'auth', CONNECTED = 'connected', FREE = 'free', ERROR = 'error';

const DRAIN = Symbol('drain');
const search = [].indexOf;

const assert = require('assert');

class Context {
    append(key, val) {
        return this._query(['APPEND', key, val]);
    }

    get(key) {
        return this._query(['GET', key]);
    }

    set(key, val) {
        return this._query(['SET', key, val]);
    }

    hget(key, hash) {
        return this._query(['HGET', key, hash]);
    }

    hkeys(key) {
        return this._query(['HKEYS', key]);
    }

    hset(key, hash, val) {
        return this._query(['HSET', key, hash, val]);
    }

    hmget(key, arr) {
        arr.unshift('HMGET', key);
        return this._query(arr);
    }

    hgetAll(key) {
        let arr = this._query(['HGETALL', key]);
        let ret = {};
        for (let i = 0, L = arr.length; i < L; i += 2) {
            ret[arr[i]] = arr[i + 1]
        }
        return ret
    }

    hsetAll(key, map) {
        let arr = ['HMSET', key];
        for (let hash in map) {
            arr.push(hash, map[hash])
        }
        if (arr.length === 4) { // hset key hash val
            arr[0] = 'HSET'
        }
        return this._query(arr)
    }

    multi() {
        return this._query(['MULTI'])
    }

    exec() {
        return this._query(['EXEC'])
    }

    expire(key, time) {
        return this._query(['EXPIRE', key, time])
    }

    exists(key) {
        return this._query(['EXISTS', key])
    }


    del(key) {
        return this._query(['DEL', key])
    }

    hdel(key, hash) {
        return this._query(['HDEL', key, hash])
    }

    hexists(key, hash) {
        return this._query(['HEXISTS', key, hash])
    }

    increase(key) {
        return this._query(['INCR', key])
    }

    decrease(key) {
        return this._query(['DECR', key])
    }

    increaseBy(key, num) {
        return this._query([(num | 0) === num ? 'INCRBY' : 'INCRBYFLOAT', key, num]);
    }

    decreaseBy(key, num) {
        return this._query([(num | 0) === num ? 'DECRBY' : 'DECRBYFLOAT', key, num]);
    }

    hincreaseBy(key, hash, num) {
        return this._query([(num | 0) === num ? 'HINCRBY' : 'HINCRBYFLOAT', key, hash, num]);

    }

    hdecreaseBy(key, hash, num) {
        return this._query([(num | 0) === num ? 'HDECRBY' : 'HDECRBYFLOAT', key, hash, num]);
    }

    query(...args) {
        return this._query(args)
    }
}


class Connection extends Context {
    constructor(socket, release) {
        super();

        this.socket = socket;
        this._close = release;
        socket._conn = this;

        const pending = this.pending = [];

        let bufLen = 0, buf = null, pos = 0;

        let reader = msgReader();

        this._ondata = function (_buf) {
            if (bufLen === pos) { // empty
                buf = _buf;
            } else {
                buf = Buffer.concat([buf.slice(pos), _buf]);
            }
            pos = 0;
            bufLen = buf.length;
            //console.log('RECV ', JSON.stringify(buf + ''));
            try {
                reader.next();
            } catch (e) {
                socket.emit('error', e);
            }
        };

        function* msgReader() {
            for (; ;) {
                let ends;
                while (bufLen < 3 + pos || (ends = search.call(buf, 13, pos + 1)) === -1 || ends === bufLen - 1) {
                    yield 0; // drain
                }
                assert(buf[ends + 1] === 10); // \r\n
                let cmd = buf[pos], msg = buf.toString('binary', pos + 1, ends);
                pos = ends + 2;
                switch (cmd) {
                    case 0x2B: // +
                        onData({message: msg});
                        continue;
                    case 0x3a: // :
                        onData(+msg);
                        continue;
                    case 0x2D: // -
                        onError(msg);
                        continue;
                    case 0x24: // $
                        onData(yield* stringReader(+msg));
                        continue;
                    case 0x2a: // *
                    {
                        let ret = [];
                        for (let i = 0, n = +msg; i < n; i++) {
                            assert(buf[pos] === 0x24); // $
                            while (bufLen < 3 + pos || (ends = search.call(buf, 13, pos + 1)) === -1 || ends === bufLen - 1) {
                                yield 0; // drain
                            }
                            assert(buf[ends + 1] === 10);

                            msg = buf.toString('binary', pos + 1, ends);
                            pos = ends + 2;
                            ret[i] = yield* stringReader(+msg);
                        }
                        onData(ret)
                    }
                }
            }
        }

        function* stringReader(strLen) {
            assert(strLen === strLen);
            if (strLen === -1) {
                return null
            }
            let strEnd;
            while ((strEnd = pos + strLen) > bufLen) {
                yield 0;
            }
            assert(buf[strEnd] === 13 && buf[strEnd + 1] === 10); // CRLF
            let ret = buf.toString('utf8', pos, strEnd);
            pos = strEnd + 2;
            return ret
        }

        function onData(data) {
            pending.shift().resolve(data)
        }

        function onError(msg) {
            pending.shift().reject(new Error(msg))
        }
    }

    _onerror(err) {
        co.removeResource(this);
        this._close = Boolean;
        const pending = this.pending;
        while (pending.length) {
            pending.pop().reject(err);
        }
    }

    auth(password) {
        const self = this;
        this.pending.push({
            resolve: function () {
                self._close()
            }, reject: function (err) {
                self.socket.destroy(err);
            }
        });
        this._send(['AUTH', password]);
    }

    _query(args) {
        const self = this;
        return co.promise(function (resolve, reject) {
            self.pending.push({resolve, reject});
            self._send(args);
        })
    }

    _send(args) {
        let buf = '*' + args.length + '\r\n$' + args[0].length + '\r\n' + args[0] + '\r\n';
        for (let i = 1; i < args.length; i++) { // TODO utf8 encode
            let argn = utf8Encode(args[i]);
            buf += '$' + argn.length + '\r\n' + argn + '\r\n'
        }
        //console.log('SEND', JSON.stringify(buf));
        this.socket.write(buf, 'binary')
    }

    release() {
        co.removeResource(this);
        this._close();
    }
}

let
    encodeBufLen = 4096,
    encodeBuf = new SlowBuffer(encodeBufLen), specialChars = /[^\x00-\x7f]/;

function utf8Encode(str) {
    if (typeof str === 'number') return '' + str;
    if (!specialChars.test(str)) return str;

    if (encodeBufLen < str.length * 3) {
        do {
            encodeBufLen <<= 1;
        } while (encodeBufLen < str.length * 3);
        encodeBuf = new SlowBuffer(encodeBufLen);
    }
    return encodeBuf.toString('binary', 0, encodeBuf.write(str))
}

export class Pool extends Context {
    constructor(port = 6379, host = '127.0.0.1', password = null, connections = 10) {
        super();

        const option = {host, port};
        const freeList = [];
        const pending = [];

        let conns = 0, connecting = 0;

        const onSocketConnected = password ? function () {
            //console.log('connected', this);
            this._state = AUTH;
            this.on('data', onSocketData).on('close', onSocketClose);

            new Connection(this, release).auth(password);
        } : function () {
            this._state = CONNECTED;
            this.on('data', onSocketData);

            freeList.push(this);
            autoConnect();
        };

        function autoConnect() {
            //console.log('autoConnect: pending=%d free=%d conns=%d connecting=%d', pending.length, freeList.length, conns, connecting);
            while (pending.length) {
                if (freeList.length) {
                    pending.shift().resolve(new Connection(freeList.shift(), release))
                } else if (conns < connections && connecting < pending.length) {
                    conns++; // total connections no more than pool size
                    connecting++; // do not create connections more than pending requests
                    const socket = _net.connect(option, onSocketConnected).once('error', onSocketError);
                    socket._state = CONNECT;
                } else { // the pool is full, wait for a connection released
                    break
                }
            }
        }

        function onSocketData(buf) {
            const conn = this._conn;
            if (conn) conn._ondata(buf)
        }

        function onSocketClose() {
            //console.log('closed', this);
            if (this._state !== ERROR)
                this.emit('error', new Error('connection closed'));
        }

        function onSocketError(err) {
            console.error(339, err);
            if (this._state === CONNECT || this._state === AUTH) { // first connect
                connecting--;
            } else { // remove from freeList
                for (let i = freeList.length; i--;) {
                    if (freeList[i] === this) {
                        freeList.splice(i, 1);
                        break;
                    }
                }
            }
            this._state = ERROR;
            const conn = this._conn;
            if (conn) {
                conn._onerror(err);
            }
            conns--; // handle
            if (!conns) {
                // no more connections, reject all pending requests
                while (pending.length) {
                    pending.pop().reject(err)
                }
            }
            //console.log('conns %d connecting %d free %d', conns, connecting, freeList.length);
        }


        function release() {
            assert(this instanceof Connection);
            let socket = this.socket;
            if (socket._state === CONNECT || socket._state === AUTH) { // first connect
                connecting--;
                socket._state = CONNECTED;
            }
            socket._conn = null;

            this._close = Boolean;
            freeList.push(socket);
            autoConnect();
        }

        this.getConnection = function () {
            let ret;
            if (freeList.length) {
                ret = new Connection(freeList.shift(), release);
            } else {
                ret = co.promise(function (resolve, reject) {
                    if (freeList.length) {
                        resolve(new Connection(freeList.shift(), release));
                    } else {
                        pending.push({resolve, reject});
                        autoConnect();
                    }
                })
            }
            co.addResource(ret);
            return ret;
        };
    }

    _query(arr) {
        const conn = this.getConnection();
        const ret = conn._query(arr);
        conn.release();
        return ret;
    }
}

const _url = require('url');

const pools = {};

export function pool(url) {
    if (url in pools) return pools[url];

    let parsed = _url.parse(url, true);
    return pools[url] = new Pool(parsed.port || undefined, parsed.hostname || undefined, parsed.auth, parsed.query.connections);
}