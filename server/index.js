/**
 * Module server also supports aliyun oss storage, modify your manifest.json like this:
 *
 *     "config": {
 *       "storage": {
 *         "name": "aliyun_oss",
 *         "bucket": "agent-k",
 *         "host": "agent-k.oss-cn-beijing.aliyuncs.com",
 *         "keyfile": "/Users/kyriosli/oss.json"
 *       },
 *       "port": "8800"
 *     }
 *
 * Where `keyfile` is a path to JSON file which kas type:
 *
 *     {"ak":"<your API key>","sk":"<your API secret>"}
 *
 * @title module server
 */

import * as http from '../src/module/http.js';
import * as response from '../src/module/http_response.js';
import * as file from '../src/module/file.js';
import {md5} from '../src/module/crypto.js';
import * as watcher from '../src/module/q_watcher.js';

watcher.listen(8801);

const storage = manifest.config.storage;
if (storage.name == 'aliyun_oss') {
    const entry = include('aliyun_oss.js', __dirname);
    storage.key = JSON.parse(file.read(storage.keyfile).toString());
    storage.get = function (req) {
        let tres = entry.get(storage, req.url, {});
        return response.stream(tres).setStatus(tres.statusCode);
    };
    storage.put = function (req, fullname, buf, sum) {
        return entry.put(storage, buf, fullname, {
            'Content-MD5': sum.toString('base64'),
            'Content-Disposition': `attachment; filename="${fullname.substr(1)}"`
        })
    };
    storage.copy = function (src, dest) {
        return entry.copy(storage, src, dest);
    };
} else if (storage.name === 'file') {
    process.chdir(storage.directory);
    storage.get = include('../src/module/static_file.js', __dirname)[moduleDefault]('.');
    storage.put = function (req, fullname, buf) {
        file.write(fullname.substr(1), buf);
        return {statusCode: 200}
    };
    storage.copy = function (src, dest) {
        dest = dest.substr(1);
        if (file.exists(dest)) {
            file.rm(dest);
        }
        file.symlink(src.substr(1), dest);
        return {statusCode: 200}
    }
}


let server = http.listen(manifest.config.port, function (req) {
    console.log(req.method, req.url);
    if (req.method === 'PUT') {
        let uploadStart = Date.now();
        let m = /^\/([^\/]+)\.js$/.exec(req.url);
        if (!m) {
            return response.error(404);
        }
        let buf = http.read(req),
            sum = md5(buf), hexsum = sum.toString('hex');
        if (hexsum !== req.headers['content-md5']) { // client error
            return response.error(400, 'md5sum mismatch');
        }
        let fullname = `/${m[1]}@${hexsum}.js`;
        let tres = storage.put(req, fullname, buf, sum);
        if (tres.statusCode >= 300) { // not OK
            return response.stream(tres).setStatus(tres.statusCode);
        }
        //console.log('upload success');
        tres = storage.copy(fullname, req.url);
        if (tres.statusCode >= 300) { // not OK
            return response.stream(tres).setStatus(tres.statusCode);
        }
        watcher.incrRecord('upload', Date.now() - uploadStart);
        return response.ok();
    } else if (req.method === 'GET') {
        watcher.incrRecord('download');
        return storage.get(req);
    } else {
        return response.error(401, 'method not implemented')
    }
});

console.log('server listening on ', server.address());
