"use strict";

import * as http from '../src/module/http.js';
import {read} from '../src/module/file.js';
import {md5} from '../src/module/crypto.js';

export default function (args) {
    let host = process.env.MODULE_SERVER_HOST, port;
    if (!host) {
        host = JSON.parse(read(require('path').join(__dirname, 'manifest.json')).toString()).config.storage.host;
        console.error("WARN: MODULE_SERVER_HOST environment varible is not set, using " + host);
    }
    let idx = host.lastIndexOf(':');
    if (idx === -1) {
        port = 80;
    } else {
        port = +host.substr(idx + 1);
        host = host.substr(0, idx);
    }

    let options = {
        method: 'PUT',
        host: host,
        port: port,
        headers: {}
    };

    for (let i = 0; i < args.length; i++) {
        let name = args[i];
        let buf = read(name + '.js'),
            sum = md5(buf, 'hex');

        options.path = `/${name}.js`;
        options.headers['Content-Length'] = buf.length;
        options.headers['Content-MD5'] = sum;

        let tres = http.request(options, buf);
        if (tres.statusCode !== 200) {
            console.log('publish ' + name + ': error ' + tres.statusCode + ' ' + tres.statusMessage);
            tres.pipe(process.stdout);
            break;
        } else {
            console.log('publish ' + name + ': OK');
        }
    }
}