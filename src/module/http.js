"use strict";

import * as zlib from 'zlib.js';
import {read as stream_read} from 'stream.js'

const ohttp = require('http'),
    ofs = require('fs');


export let maxSockets = 5;

function HttpRequest() {

}

function HttpResponse(req, res) {
    let status = 200,
        headers = {},
        bufs = [],
        ended = false,
        gzip = false;

    return {
        set status(stat) {
            status = stat
        },
        setHeader: function (key, val) {
            headers[key] = val
        },
        write: function (buf) {
            if (typeof buf === 'string') buf = new Buffer(buf);
            bufs.push(buf)
        },
        enableGzip: function () {
            gzip = gzip || /\bgzip\b/.test(req.headers['accept-encoding'])
        },
        stream: function (stream) {
            let input = stream;
            if (gzip) {
                headers['Content-Encoding'] = 'gzip';
                input = zlib.gzipTransform(stream)
            }
            res.writeHead(status, headers);
            input.pipe(res);

            co.wrap(function (resolve, reject) {
                stream.on('end', resolve).on('error', reject)
            });
            ended = true;
            return this
        },
        file: function (path) {
            return this.stream(ofs.createReadStream(path));
        },
        end: function () {
            if (ended) return;
            ended = true;
            let content = Buffer.concat(bufs);
            if (gzip) {
                content = zlib.gzip(content);
                headers['Content-Encoding'] = 'gzip';
            }
            headers['Content-Length'] = content.length;
            res.writeHead(status, headers);
            res.end(content)
        }
    };
}

export function listen(port, cb) {
    return ohttp.createServer(function (req, res) {
        let resp = HttpResponse(req, res);
        co.promise(function () {
            cb(req, resp);
            resp.end();
        }).then(function () { // succ
        }, function (err) { // on error
            res.writeHead(500);
            res.end(err.message);
            console.error(err.stack);
        })
    }).listen(port);
}

export function request(options, body) {
    return co.wrap(function (resolve, reject) {
        ohttp.request(options, resolve).on('error', reject).end(body);
    });
}

export function read(incoming) {
    if (incoming.headers['content-encoding'] === 'gzip') { // gzipped
        incoming = zlib.gunzipTransform(incoming);
    }
    return stream_read(incoming)
}

