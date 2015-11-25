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

    hgetall(key) {
        let arr = this._query(['HGETALL', key]);
        let ret = {};
        for (let i = 0, L = arr.length; i < L; i += 2) {
            ret[arr[i]] = arr[i + 1]
        }
        return ret
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
        return this._query(['INCRBY', key, num]);
    }

    decreaseBy(key, num) {
        return this._query(['DECRBY', key, num]);
    }

    query(...args) {
        return this._query(args)
    }
}


let nextID = 0;
class Connection extends Context {
    constructor(socket, release) {
        super();

        this.id = nextID++;
        this.socket = socket;
        this.release = release;
        socket._conn = this;

        const pending = this.pending = [];
        let remained = null;

        this._ondata = function (buf) {
            //console.log('RECV ', JSON.stringify(buf + ''));
            try {
                readResults(remained ? Buffer.concat([remained, buf]) : buf);
            } catch (e) {
                socket.emit('error', e);
            }
        };

        function readResults(buf) {
            let pos = 0, len = buf.length;

            while (pos < len) {
                const currentPos = pos;
                let ret = read();
                if (ret === DRAIN) {
                    remained = buf.slice(currentPos);
                    return
                }
            }
            remained = null;

            function read() {
                let ends = search.call(buf, 13, pos + 1);
                if (ends === -1 || ends === len - 1) { // no CRLF
                    return DRAIN
                }
                assert(buf[ends + 1] === 10);
                let cmd = buf[pos], msg = buf.toString('binary', pos + 1, ends);
                pos = ends + 2;
                switch (cmd) {
                    case 0x2B: // +
                        onData({message: msg});
                        return;
                    case 0x2D: // -
                        onError(msg);
                        return;
                    case 0x24: // $
                    {
                        let ret = readString(+msg);
                        if (ret === DRAIN) return DRAIN;
                        onData(ret);
                        return
                    }
                    case 0x3a: // :
                        onData(+msg);
                        break;
                    case 0x2a: // *
                    {
                        let ret = [];
                        for (let i = 0, n = +msg; i < n; i++) {
                            assert(buf[pos] === 0x24); // $
                            ends = search.call(buf, 13, pos + 1);
                            if (ends === -1 || ends === len - 1) { // no CRLF
                                return DRAIN
                            }
                            assert(buf[ends + 1] === 10);
                            msg = buf.toString('binary', pos + 1, ends);
                            pos = ends + 2;
                            let data = readString(+msg);
                            if (data === DRAIN) return DRAIN;
                            ret[i] = data
                        }
                        onData(ret)
                    }
                }
                // update pos
            }

            function readString(strLen) {
                //if (Math.random() > 0.5) throw new Error('random throws');
                assert(strLen === strLen);
                if (strLen === -1) {
                    return null
                }
                let newEnd = pos + strLen;
                if (newEnd + 2 > len) {
                    return DRAIN
                }
                assert(buf[newEnd] === 13 && buf[newEnd + 1] === 10); // CRLF
                let ret = buf.toString('utf8', pos, newEnd);
                pos = newEnd + 2;
                return ret
            }
        }

        function onData(data) {
            pending.shift().resolve(data)
        }

        function onError(msg) {
            pending.shift().reject(new Error(msg))
        }
    }

    _onerror(err) {
        this.release = Boolean;
        const pending = this.pending;
        while (pending.length) {
            pending.pop().reject(err);
        }
    }

    auth(password) {
        const self = this;
        this.pending.push({
            resolve: function () {
                self.release()
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
}

let encodeBufLen = 4096,
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
            this._state = AUTH;
            this.on('data', onSocketData);

            new Connection(this, release).auth(password);
        } : function () {
            this._state = CONNECTED;
            this.on('data', onSocketData);

            freeList.push(this);
            autoConnect();
        };

        function autoConnect() {
            while (pending.length) {
                if (freeList.length) {
                    pending.shift().resolve(new Connection(freeList.shift(), release))
                } else if (conns < connections && connecting < pending.length) {
                    conns++; // total connections no more than pool size
                    connecting++; // do not create connections more than pending requests
                    const socket = _net.connect(option, onSocketConnected).once('error', onSocketError);
                    socket._state = CONNECT;
                    socket.id = nextID++;
                } else { // the pool is full, wait for a connection released
                    break
                }
            }
        }

        function onSocketData(buf) {
            const conn = this._conn;
            if (conn) conn._ondata(buf)
        }

        function onSocketError(err) {
            if (this._state === CONNECT || this._state === AUTH) { // first connect
                connecting--;
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
            //console.log('connection released');
            assert(this instanceof Connection);
            let socket = this.socket;
            if (socket._state === CONNECT || socket._state === AUTH) { // first connect
                connecting--;
                socket._state = CONNECTED;
            }
            socket._conn = null;

            this.release = Boolean;
            freeList.push(socket);
            autoConnect();
        }

        this.getConnection = function () {
            if (freeList.length) {
                return new Connection(freeList.shift(), release);
            }
            return co.promise(function (resolve, reject) {
                if (freeList.length) {
                    resolve(new Connection(freeList.shift(), release));
                } else {
                    pending.push({resolve, reject});
                    autoConnect();
                }
            })
        };
    }

    _query(arr) {
        const conn = this.getConnection();
        const ret = conn._query(arr);
        conn.release();
        return ret;
    }
}