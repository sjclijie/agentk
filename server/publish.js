"use strict";

import * as http from '../src/module/http';
import {read, exists} from '../src/module/file';
import {md5} from '../src/module/crypto';

export default function (args) {
    let host = process.env.MODULE_SERVER_HOST;
    if (!host) {
        let configFile = require('path').join(process.env.HOME, '.agentk/config.json');
        if (exists(configFile)) {
            try {
                host = JSON.parse('' + read(configFile))['server.host'];
            } catch (e) {
            }
        }
    }
    if (!host) {
        host = JSON.parse(read(require('path').join(__dirname, 'manifest.json')).toString()).config.storage.host;
        console.error("WARN: MODULE_SERVER_HOST environment varible is not set, using " + host);
    }

    let options = {
        method: 'PUT',
        headers: {}
    };

    for (let i = 0; i < args.length; i++) {
        let name = args[i];
        let buf = read(name + '.js'),
            sum = md5(buf, 'hex');

        options.headers['Content-Length'] = buf.length;
        options.headers['Content-MD5'] = sum;
        options.body = buf;

        let res = co.yield(http.fetch(`http://${host}/${name}.js`, options));
        if (res.ok) {
            console.log('publish ' + name + ': OK');
        } else {
            console.log('publish ' + name + ': error ' + res.status + ' ' + tres.statusText);
            res.stream.pipe(process.stdout);
            break;
        }
    }
}