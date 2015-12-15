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

export function update(modules) {
    const cached = process.properties.cached;
    let manifest = global.manifest,
        dependencies = manifest && manifest.dependencies;

    if (!modules.length) {
        for (let file of readdir('.')) {
            let m = /^(\w+)\.js$/.exec(file);
            if (!m) {
                // maybe http@xxxxxxxxxxxx.js
                continue;
            }
            modules.push(m[1]);
        }
    }

    let maxLen = 0;
    for (let name of modules) {
        if (name.length > maxLen) maxLen = name.length;
    }

    let prefix = ' '.repeat(maxLen) + ' : ';

    let upToDates = [], upgraded = 0;

    for (let name of modules.sort()) {
        if (dependencies && name in dependencies && dependencies[name] !== '*') {
            // dependencies specifies percific version
            continue;
        }
        let file = name + '.js';
        let hash = md5(read(file)).toString('hex');
        let res = co.yield(http.fetch(`http://${host}/${name}.js`, {
            headers: {'if-none-match': '"' + hash.toUpperCase() + '"'}
        }));

        let log_prefix = name + prefix.substr(name.length);

        if (res.status === 304) {
            upToDates.push(name);
            continue;
        }
        if (res.status === 404) {
            process.stdout.write('\x1b[31m' + log_prefix + 'not found on remote server\x1b[0m\n');
            continue;
        }
        let content = co.yield(res.buffer()),
            checksum = md5(content).toString('hex').toUpperCase(),
            etag = '"' + checksum + '"';
        if (etag !== res.headers.get('etag')) {
            process.stdout.write('\x1b[34m' + log_prefix + 'checksum mismatch (not updated)\x1b[0m\n');
            continue;
        }
        if (cached) { // rename file
            rename(file, name + '@' + hash + '.js');
        }
        write(file, content);
        process.stdout.write('\x1b[36m' + log_prefix + 'updated\x1b[0m\n');
        upgraded++;
    }
    let tail = '\n' + upgraded + ' updated / ' + upToDates.length + ' up to date';
    if (upToDates.length) {
        tail += ':\n  \x1b[32m' + upToDates.join(' ') + '\x1b[0m\n'
    } else {
        tail += '.\n'
    }
    process.stdout.write(tail);
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