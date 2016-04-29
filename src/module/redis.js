/**
 * @title Redis Client
 */

import ConnectionPool from 'connection_pool';

const SlowBuffer = require('buffer').SlowBuffer;

const assert = require('assert');

import {Input} from 'stream';

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
    constructor(socket) {
        if (socket._conn) throw new Error('socket occupied');
        super();

        this.socket = socket;
        socket._conn = this;
        co.addResource(this);
    }

    auth(password) {
        return this._query(['AUTH', password]);
    }

    _query(args) {
        const socket = this.socket;

        // begin write
        let buf = '*' + args.length + '\r\n$' + args[0].length + '\r\n' + args[0] + '\r\n';
        for (let i = 1; i < args.length; i++) { // TODO utf8 encode
            let argn = utf8Encode(args[i]);
            buf += '$' + argn.length + '\r\n' + argn + '\r\n'
        }
        // console.log('SEND', args);
        socket.write(buf, 'binary');

        // begin read
        const input = socket._input || (socket._input = new Input(socket));
        const head = input.readLine();
        assert(head[head.length - 2] === 13); // \r\n

        const cmd = head[0], msg = head.toString('binary', 1, head.length - 2);
        switch (cmd) {
            case 0x2B: // +
                return {message: msg};
            case 0x3a: // :
                return +msg;
            case 0x2D: // -
                throw new Error(msg);
            case 0x24: // $
                return readString(+msg);
            case 0x2a: // *
            {
                const ret = [];
                for (let i = 0, n = +msg; i < n; i++) {
                    const stringHead = input.readLine();
                    assert(stringHead[0] === 0x24 && stringHead[stringHead.length - 2] === 13 && stringHead[stringHead.length - 1] === 10); // $
                    ret[i] = readString(+stringHead.toString('binary', 1, stringHead.length - 2))

                }
                return ret;
            }
        }

        function readString(length) {
            if (length === -1) return null;
            const buf = input.read(length + 2);
            assert(buf[length] === 13 && buf[length + 1] === 10);
            return buf.toString('utf8', 0, length);
        }
    }

    release() {
        co.removeResource(this);
        this._close();
    }

    _close() {
        const socket = this.socket;
        this.socket = socket._conn = null;
        socket._release();
    }
}


function redis_close() {
    const conn = this._conn;
    if (!conn) return;
    const err = new Error('connection closed');
    for (let pending of conn.pending.splice(0)) {
        pending.reject(err);
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


export class Pooled extends Context {
    constructor(pool, password = null) {
        super();

        this.getConnection = password ? function (key) {
            let socket = pool.getConnection(key)
            let conn = new Connection(socket);
            if (!socket._authed) {
                socket.once('close', redis_close);
                try {
                    conn.auth(password);
                } catch (e) {
                    socket.destroy();
                    throw e;
                }
                socket._authed = true;
            }
            return conn;
        } : function (key) {
            let socket = pool.getConnection(key);
            let conn = new Connection(socket);
            return conn;
        };

    }

    _query(arr) {
        const conn = this.getConnection(arr[1]);
        const ret = conn._query(arr);
        conn.release();
        return ret;
    }
}

const _url = require('url');


export function pool(url) {
    const {query: {connections}, auth, hostname, port} = _url.parse(url, true);

    return new Pooled(
        new ConnectionPool([`${hostname || '127.0.0.1'}:${port || 6379}`], connections),
        auth
    );
}