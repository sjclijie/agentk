"use strict";

var ohttp = require('http');

export let maxSockets = 5;

export function listen(port, cb) {
    return ohttp.createServer(function (req, res) {
        co.promise(function () {
            var headers = {}, bufs = [];
            cb({
                url: req.url, headers: req.headers
            }, {
                setHeader: function (key, val) {
                    headers[key] = val
                },
                write: function (buf) {
                    //console.log('write', buf);
                    bufs.push(buf);
                }
            });
            var content = Buffer.concat(bufs);
            headers['Content-Length'] = content.length;
            res.writeHead(200, headers);
            res.end(content);
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
    return co.wrap(function (resolve, reject) {
        var bufs = [];
        incoming.on('data', function (data) {
            bufs.push(data);
        }).on('end', function () {
            resolve(Buffer.concat(bufs));
        })
    })
}

