import * as http from 'http';
import {sha1} from 'crypto';

const _http = require('http'),
    _zlib = require('zlib');

const parsers = require('_http_common').parsers;
const kREQUEST = process.binding('http_parser').HTTPParser.REQUEST;

const EventEmitter = require('events');
const unique_key = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

const CLOSE = new (require('buffer').SlowBuffer)([0x88, 0x00]),
    ABORT = new (require('buffer').SlowBuffer)([0x88, 0x02, 0xEA, 0x03]);

class WebSocket extends EventEmitter {
    constructor(socket, options) {
        super();
        const self = this;

        self._socket = socket;
        self._writer = socket;
        self._closed = false;

        let bufLen = 0, buf = null, pos = 0;

        const reader = msgReader();
        const useDeflate = self._deflate = options.useDeflate;

        let inflater;
        if (useDeflate) {
            inflater = _zlib.createInflateRaw();
            inflater.on('data', function (data) {
                console.log('on inflated', data);
                reader.next(data);
            });

            let deflater = self._deflater = _zlib.createDeflateRaw();
            deflater.on('data', function (data) {
                console.log('on deflated', data)
            })
        }

        self._push = send;

        const header = new (require('buffer').SlowBuffer)(10);

        function send(opcode, payload) {
            if (self._closed) return;
            let headerLen, payloadLen = payload.length;
            header[0] = opcode | 0x80;
            if (payloadLen > 65535) {
                headerLen = 10;
                header[1] = 127;
                header.writeUInt32BE(payloadLen / 0x10000000 | 0, 2, true);
                header.writeUInt32BE(payloadLen | 0, 6, true);
            } else if (payloadLen > 125) {
                headerLen = 4;
                header[1] = 126;
                header.writeUInt16BE(payloadLen | 0, 2, true);
            } else {
                headerLen = 2;
                header[1] = payloadLen;
            }
            socket.write(header.slice(0, headerLen));
            socket.write(payload);
        }

        socket.on('data', function (_buf) {
            if (self._closed) return;
            if (bufLen === pos) { // empty
                buf = _buf;
            } else {
                buf = Buffer.concat([pos ? buf.slice(pos) : buf, _buf]);
            }
            pos = 0;
            bufLen = buf.length;
            //console.log('RECV ', JSON.stringify(buf + ''));
            try {
                reader.next();
            } catch (e) {
                console.error(e.stack);
                socket.destroy();
                onclose();
            }
        }).on('close', onclose).on('error', function (err) {
            this.destroy();
            console.log('on socket error', err.message);
            onclose();
        });

        function onclose() {
            if (self._closed) return;
            self._closed = true;
            self._socket = null;
            self.emit('close');
        }

        function* msgReader() {
            for (; ;) {
                while (bufLen < pos + 6) yield 0;
                let tmp = buf[pos],
                    opcode = tmp & 0xf,
                    bits = tmp >> 4 & 7,
                    fin = tmp >> 7 & 1;
                tmp = buf[pos + 1];
                let payloadLen = tmp & 0x7f,
                    hasMask = tmp >> 7 & 1;
                console.log('RECV', buf, tmp, opcode, hasMask, payloadLen);
                if (!hasMask) { // must close socket
                    socket.end('\x88\x02\xea\x03', 'binary');
                    onclose();
                    return
                }
                pos += 2;
                if (payloadLen === 126) { // payload len is 2 bytes
                    while (bufLen < pos + 6) yield 0;
                    payloadLen = buf.readUInt16BE(pos, true); // FIXME
                    pos += 2;
                } else if (payloadLen === 127) { // payload len is 8 bytes
                    while (bufLen < pos + 12) yield 0;
                    payloadLen = buf.readUInt32BE(pos, true); // FIXME
                    payloadLen = payloadLen * 0x100000000 + buf.readUInt32BE(pos + 4, true);
                    pos += 8;
                }
                // read mask
                const mask = buf.slice(pos, pos + 4);
                pos += 4;
                while (bufLen < pos + payloadLen) yield 0;
                let payload = buf.slice(pos, pos + payloadLen);
                pos += payloadLen;

                for (let i = 0; i < payloadLen; i++) {
                    payload[i] ^= mask[i & 3]
                }
                console.log('fin=' + fin, 'bits=' + bits, 'payload=' + payloadLen, payload, 'mask=', mask);
                if (useDeflate && bits & 4) {
                    inflater.write(payload);
                    inflater.write(new Buffer([0x00, 0x00, 0xff, 0xff]));
                    while (!(payload = yield 0));
                    console.log('inflated', payload);
                }
                let data;
                switch (opcode) {
                    case 1: // text
                        data = payload.toString('utf8');
                        break;
                    case 8: // close
                        onclose();
                        socket.destroy();
                        return;
                }
                self.emit('message', data);
            }
        }
    }

    send(msg) {
        if (this._closed) throw new Error('websocket closed');
        let opcode, payload;
        if (typeof msg === 'string') {
            opcode = 1;
            payload = new Buffer(msg.length * 3);
            payload = payload.slice(0, payload.write(msg));
        } // else
        this._push(opcode, payload);
    }

    close(fail) {
        if (this._closed) throw new Error('websocket closed');
        this._socket.write(fail ? '\x88\x02\xea\x03' : '\x88\x00', 'binary');
        this._socket.destroySoon();
        this._socket = null;
        this._closed = true;
        this.emit('close');
    }
}

function onWsTimeout(ws) {
    let socket = ws._socket;
    ws._socket = ws._timer = null;
    close(socket, 400);
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

        const extensions = this.headers.getAll('Sec-WebSocket-Extensions').join(',');

        const headers = [
            'HTTP/1.1 101 Switch Protocol',
            'Upgrade: WebSocket',
            'Connection: Upgrade',
            'Sec-WebSocket-Accept: ' + sha1(key + unique_key, 'base64')
        ];

        const useDeflate = /permessage-deflate/.test(extensions) && false;
        if (useDeflate) {
            headers.push('Sec-WebSocket-Extensions: permessage-deflate; client_max_window_bits=15')
        }
        console.log(headers.join('\r\n') + '\r\n');
        socket.write(headers.join('\r\n') + '\r\n\r\n', 'binary');
        return new WebSocket(socket, {useDeflate});
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
        }).once('error', reject).once('error', reject).on('upgrade', function (req, socket, body) {
            socket.once('error', socket.destroy);
            if (req.headers.upgrade !== 'websocket') {
                return close(socket, 400, 'Bad Request');
            }
            co.run(resolver, new WsRequest(req, socket)).then(null, function (err) {
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
    socket.end(buf);
    console.log(header + buf);
    socket.destroySoon();
}

function groupHeaders(obj) {
    const entries = obj._entries;
    let headers = '';
    for (let key in entries) {
        let arr = entries[key];
        for (let i = 1; i < arr.length; i++) {
            headers += arr[0] + ': ' + arr[i] + '\r\n';
        }
    }
    return headers;
}