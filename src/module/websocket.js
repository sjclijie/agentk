/**
 * Websocket protocol implemention.
 * 
 * @example
 *
 *     import {listen, TYPE_TEXT} from 'module/websocket';
 *     let server = listen(1234, function (req) {
 *         if(req.pathname !== '/foo') {
 *             return req.reject();
 *         }
 *
 *         let ws = req.accept();
 *
 *         ws.send('hello');
 *
 *         ws.on('message', function (msg, type) {
 *             if(type === TYPE_TEXT) console.log('recv text', msg);
 *         });
 *     }
 */


import * as http from 'http';
import {sha1} from 'crypto';

const _zlib = require('zlib');

const _http = require('http');

const parsers = require('_http_common').parsers;
const kREQUEST = process.binding('http_parser').HTTPParser.REQUEST;

const EventEmitter = require('events');
const unique_key = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

const SlowBuffer = require('buffer').SlowBuffer;

const ABORT = new Buffer(0);

const FIN = 8, RSV1 = 4, RSV2 = 2, RSV3 = 1;
const INFLATE_TAIL = new SlowBuffer(4);
INFLATE_TAIL.write('\x00\x00\xff\xff\xde\xad\xbe\xef\xca\xbd', 'binary');

export const TYPE_TEXT = 'text', TYPE_BUFFER = 'buffer';

function makeDeflater(onMessage) {
    const deflater = _zlib.createDeflateRaw({flush: _zlib.Z_SYNC_FLUSH}),
        onFlush = makeFlusher(deflater, onMessage);

    return function (buf) {
        deflater.write(buf);
        deflater.flush(_zlib.Z_SYNC_FLUSH, onFlush)
    };
}

function makeInflater(onMessage) {
    const inflater = _zlib.createInflateRaw(),
        onFlush = makeFlusher(inflater, onMessage);

    return function (buf) {
        inflater.write(buf);
        inflater.write(INFLATE_TAIL);
        inflater.flush(onFlush)
        return 0x7fffffff; // prevent triggering reader::next
    };
}

function makeFlusher(stream, onMessage) {
    const received = [];
    let recvLen = 0;
    stream.on('data', function (buf) {
        recvLen += buf.length;
        received.push(buf);
    });

    return function onFlush() {
        const block = Buffer.concat(received, recvLen);
        received.length = recvLen = 0;
        onMessage(block);
    }
}

class WebSocket extends EventEmitter {
    constructor(socket, settings) {
        super();
        const self = this;
        const reader = msgReader()
        let expected = 0;
        const useDeflate = self.useDeflate = !!settings['permessage-deflate'], inflate = useDeflate && makeInflater(function (buf) {
                expected = reader.next(buf);
            });

        if (useDeflate) {
            const opcodes = [], deflate = makeDeflater(function (buf) {
                send(opcodes.shift() | 0x40, buf.slice(0, -4))
            });
            self._send = function (opcode, payload) {
                opcodes.push(opcode);
                deflate(payload)
            }
        } else {
            self._send = send;
        }

        self.close = function (code = 1000, reason = '') {
            const payload = new Buffer(2 + reason.length);
            payload.writeUInt16BE(code, 0, true);
            payload.write(reason, 2, reason.length, 'binary');
            send(8, payload);
            socket.removeAllListeners('data');
            socket.destroySoon();
            bufLen = -1;
            onclose(code, reason);
        }

        function send(opcode, payload) {
            let payloadLen = payload.length, bufLen = payloadLen + 2;
            if (payloadLen > 65535) {
                bufLen += 8
            } else if (payloadLen > 125) {
                bufLen += 2
            }
            let buf = new Buffer(bufLen), pos = 2;
            buf[0] = opcode | 0x80;
            if (payloadLen > 65535) {
                buf[1] = 127;
                buf.writeUInt32BE(payloadLen / 0x10000000 | 0, 2, true);
                buf.writeUInt32BE(payloadLen | 0, 6, true);
                pos = 10;
            } else if (payloadLen > 125) {
                buf[1] = 126;
                buf.writeUInt16BE(payloadLen | 0, 2, true);
                pos = 4;
            } else {
                buf[1] = payloadLen;
            }
            payload.copy(buf, pos);
            // console.log('SEND ', buf);
            socket.write(buf);
        }

        let closed = self._closed = false;

        let bufLen = 0, buf = null, pos = 0;

        socket.on('data', function (_buf) {
            if (closed) return;
            if (bufLen === pos) { // empty
                buf = _buf;
            } else {
                buf = Buffer.concat([pos ? buf.slice(pos) : buf, _buf]);
            }
            pos = 0;
            bufLen = buf.length;
            // console.log('RECV ', buf.length, buf);
            if (bufLen < expected) return;
            try {
                expected = reader.next().value;
            } catch (e) {
                console.error('uncaught', e.stack);
                socket.destroy();
                onclose(1011, e.message);
            }
        }).on('close', function () {
            onclose(1001, 'connection closed')
        }).on('error', function (err) {
            this.destroy();
            onclose(1006, err.message);
        });

        function onclose(code, reason) {
            if (closed) return;
            self._closed = closed = true;
            self.emit('close', code, reason);
        }

        function* msgReader() {
            for (; ;) {
                if (bufLen === -1) return;
                while (bufLen < pos + 6) yield 6;
                let tmp = buf.readUInt16LE(pos, true),
                    flags = tmp >> 4 & 0xf,
                    opcode = tmp & 0xf,
                    hasMask = tmp >> 15 & 1,
                    payloadLen = tmp >> 8 & 0x7f;
                // TODO not fin
                if (!hasMask) { // must close socket
                    socket.end(ABORT);
                    onclose();
                    return
                }
                pos += 2;
                if (payloadLen === 126) { // payload len is 2 bytes
                    while (bufLen < pos + 6) yield 6;
                    payloadLen = buf.readUInt16BE(pos, true); // FIXME
                    pos += 2;
                } else if (payloadLen === 127) { // payload len is 8 bytes
                    while (bufLen < pos + 12) yield 12;
                    payloadLen = buf.readUInt32BE(pos, true); // FIXME
                    payloadLen = payloadLen * 0x100000000 + buf.readUInt32BE(pos + 4, true);
                    pos += 8;
                }
                // read mask
                const mask = buf.slice(pos, pos + 4);
                pos += 4;
                while (bufLen < pos + payloadLen) yield payloadLen;
                for (let i = 0; i < payloadLen; i++) {
                    buf[i + pos] ^= mask[i & 3]
                }
                let payload = buf.slice(pos, pos + payloadLen);
                pos += payloadLen;
                if (useDeflate && flags & RSV1) { // RSV1
                    payload = yield inflate(payload);
                }
                let type, data;
                switch (opcode) {
                    case 1: // text
                        type = TYPE_TEXT;
                        data = payload.toString();
                        break;
                    case 2: //buffer
                        type = TYPE_BUFFER;
                        data = payload;
                        break;
                    case 8: // close
                        if (payload.length) {
                            onclose(payload.readUInt16BE(0, true), payload.toString('utf8', 2));
                        } else {
                            onclose(1000, '');
                        }
                        socket.destroy();
                        return;
                }
                try {
                    self.emit('message', data, type);
                } catch (e) {
                    console.error('uncaught', e.stack);
                    self.close(1011, e.message);
                    return;
                }
            }
        }

    }

    send(msg) {
        if (this._closed) throw new Error('websocket closed');
        let opcode, payload;
        if (Buffer.isBuffer(msg)) {
            opcode = 2;
            payload = msg;
        } else {
            msg = '' + msg;
            opcode = 1;
            payload = new Buffer(msg.length * 3);
            payload = payload.slice(0, payload.write(msg));
        }

        this._send(opcode, payload);
    }
}

function onWsTimeout(ws) {
    let socket = ws._socket;
    ws._socket = ws._timer = null;
    close(socket, 400);
}

const extensions = {
    'permessage-deflate': {
        setup(params, headers, settings) {
            if (settings['permessage-deflate']) return;
            settings['permessage-deflate'] = true;
            headers.append('Sec-WebSocket-Extensions', 'permessage-deflate');
        }
    }
}

export class WsRequest extends http.Request {
    constructor(request, socket) {
        request.body = request;
        super(request.url[0] === '/' ? 'http://' + request.headers.host + request.url : request.url, request);
        socket.request = this;

        this.request = request;

        // init req object
        this.originalUrl = request.url;
        this._socket = socket;
        this._timer = setTimeout(onWsTimeout, 3000, this);
    }

    setTimeout(timeout) {
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = setTimeout(onWsTimeout, timeout, this);
        }
    }

    accept() {
        if (!this._socket) throw new Error('request has been accepted or rejected');
        clearTimeout(this._timer);
        let socket = this._socket;
        this._socket = this._timer = socket.request = null;
        let key = this.headers.get('sec-websocket-key');
        const headers = new http.Headers({
            Upgrade: 'WebSocket',
            Connection: 'Upgrade',
            'Sec-WebSocket-Accept': sha1(new Buffer(key + unique_key), 'base64')
        }), settings = {};
        const extensionString = this.headers.get('sec-websocket-extensions');
        if (extensionString) {
            for (let extension of extensionString.split(/,\s*/)) {
                const arr = extension.split('; '), name = arr[0];
                if (!(name in extensions)) continue;
                const params = {};
                // for (let i = 1; i < arr.length; i++) {
                //     const param = arr[i], idx = param.indexOf('=');
                //     if (idx === 0) {
                //         params[param] = true
                //     } else {
                //         params[param.substr(0, idx)] = param.substr(idx + 1)
                //     }
                // }
                extensions[name].setup(params, headers, settings)
            }
        }
        socket.write('HTTP/1.1 101 Switch Protocol\r\n' + groupHeaders(headers) + '\r\n', 'binary');
        return new WebSocket(socket, settings);
    }

    reject(status = 400, message = null) {
        if (!this._socket) return;
        clearTimeout(this._timer);
        let socket = this._socket;
        this._socket = this._timer = null;
        close(socket, status, null, message);
    }
}


export function listen(port, cb, options = {}) {

    return co.promise(function (resolve, reject) {
        const server = _http.createServer(function (req, res) {
            res.writeHead(400, {Connection: 'close'});
            res.end();
        }).once('error', reject);
        server.on('upgrade', function (req, socket, body) {
            console.log(req.method, req.url, req.headers);
            socket.once('error', socket.destroy);
            if (req.headers.upgrade.toLowerCase() !== 'websocket') {
                return close(socket, 400, 'Bad Request');
            }
            co.run(resolver, new WsRequest(req, socket)).then(null, function (err) {
                console.error(err);
                if (socket.request) {
                    socket.request.reject(500, err.message);
                }
            });
        });
        server.listen(port, function () {
            server.removeListener('error', reject);
            resolve(server);
        })
    });

    function resolver(req) {
        return cb.apply(req, [req])
    }

}


function close(socket, status, statusText, body, headers) {
    let buf = typeof body === 'string' ? new Buffer(body) : Buffer.isBuffer(body) ? body : body ? new Buffer(body + '') : new Buffer(0);

    let header = `HTTP/1.1 ${status} ${statusText || _http.STATUS_CODES[status]}\r\n${headers || ''}Content-Length: ${buf.length}\r\nConnection: close\r\n\r\n`;
    socket.write(header);
    socket.write(buf);
    socket.destroySoon();
}

function groupHeaders(obj) {
    const entries = obj._entries;
    let headers = '';
    for (let key in entries) {
        let arr = entries[key];
        for (let i = 0; i < arr.length; i++) {
            headers += arr.name + ': ' + arr[i] + '\r\n';
        }
    }
    return headers;
}