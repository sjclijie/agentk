"use strict";

import * as zlib from 'zlib.js';
import {read as stream_read} from 'stream.js'

const ohttp = require('http');

export let maxSockets = 5;

export function listen(port, cb) {
    return co.wrap(function (resolve, reject) {
        let server = ohttp.createServer(function (req, res) {
            co.promise(function () {
                return cb(req);
            }).then(function (resp) { // succ
                if (!resp) return res.end();

                res.statusCode = resp.status;
                for (let key of Object.keys(resp.headers)) {
                    res.setHeader(key, resp.headers[key])
                }

                resp.handle(req, res)
            }).then(null, function (err) { // on error
                res.writeHead(500);
                res.end(err.message);
                console.error(err.stack);
            })
        }).listen(port, function () {
            resolve(server)
        }).on('error', reject);
    });
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

