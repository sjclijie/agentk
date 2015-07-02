"use strict";

let fs = require('fs'), crypto = require('crypto'), http = require('http');

module.exports = function (args) {
    if (!process.env.MODULE_SERVER_HOST) {
        throw new Error("MODULE_SERVER_HOST environment variable is not defined");
    }
    next(0);
    function next(i) {
        if (i === args.length) return;
        let name = args[i];
        let buf = fs.readFileSync(name + '.js'),
            sum = crypto.createHash('md5').update(buf).digest('hex');

        http.request({
            method: 'PUT',
            host: process.env.MODULE_SERVER_HOST,
            port: process.env.MODULE_SERVER_PORT || "8800",
            path: '/' + name + '@' + sum + '.js',
            headers: {
                'Content-Length': buf.length
            }
        }, function (tres) {
            if (tres.statusCode === 200) {
                console.log('publish ' + name + ': OK');
                next(i + 1);
            } else {
                console.log('publish ' + name + ': error ' + tres.statusCode + ' ' + tres.statusMessage);
                tres.pipe(process.stdout);
            }
        }).end(buf)
    }
};