"use strict";

import * as http from '../src/module/http';
import {read, write, readdir, exists, rename} from '../src/module/file';
import {md5} from '../src/module/crypto';


let host = process.env.MODULE_SERVER_HOST;
if (!host) {
    let configFile = require('path').join(process.env.HOME, '.agentk/config.json');
    if (exists(configFile)) {
        try {
            host = JSON.parse('' + read(configFile))['module.server'];
        } catch (e) {
        }
    }
}
if (!host) {
    host = JSON.parse(read(require('path').join(__dirname, 'manifest.json')).toString()).config.storage.host;
    console.error("WARN: MODULE_SERVER_HOST environment varible is not set, using " + host);
}

export function update() {
    const cached = process.properties.cached;
    let manifest = global.manifest,
        dependencies = manifest && manifest.dependencies;
    for (let file of readdir('.')) {
        let m = /^(\w+)\.js$/.exec(file);
        if (!m) {
            // maybe http@xxxxxxxxxxxx.js
            continue;
        }
        let name = m[1];
        if (dependencies && name in dependencies && dependencies[name] !== '*') {
            // dependencies specifies percific version
            continue;
        }
        let hash = md5(read(file)).toString('hex');
        let res = co.yield(http.fetch(`http://${host}/${name}.js`, {
            headers: {'if-none-match': '"' + hash.toUpperCase() + '"'}
        }));
        if (res.status === 304) {
            console.log(name + '\t: not modified (' + hash + ')');
            continue;
        }
        if (res.status === 404) {
            console.log(name + '\t: not found on remote server');
            continue;
        }
        let content = co.yield(res.buffer()),
            checksum = md5(content).toString('hex').toUpperCase(),
            etag = '"' + checksum + '"';
        if (etag !== res.headers.get('etag')) {
            console.log(name + '\t: checksum mismatch (not updated)');
            continue;
        }
        if (cached) { // rename file
            rename(file, name + '@' + hash + '.js');
        }
        write(file, content);
        console.log(name + '\t: updated (' + checksum + ')');
    }
}

export default function (args) {

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
            console.log('publish ' + name + ': error ' + res.status + ' ' + res.statusText);
            res.stream.pipe(process.stdout);
            break;
        }
    }
}