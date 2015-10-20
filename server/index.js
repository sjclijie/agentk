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

import * as http from '../src/module/http';
import * as file from '../src/module/file';
import {md5} from '../src/module/crypto';

const storage = manifest.config.storage;
if (storage.name == 'aliyun_oss') {
    const entry = include('aliyun_oss.js', __dirname);

    storage.key = JSON.parse(file.read(storage.keyfile).toString());
    storage.get = function (req) {
        return entry.get(storage, req.url, {});
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
    file.mkdirp(storage.directory);
    process.chdir(storage.directory);
    storage.get = include('../src/module/static_file.js', __dirname)[moduleDefault]('.', {
        hash_method(content, stat) {
            return '"' + md5(content, 'hex').toUpperCase() + '"'
        }
    });
    storage.put = function (req, fullname, buf) {
        file.write(fullname.substr(1), buf);
        return {ok: true}
    };
    storage.copy = function (src, dest) {
        dest = dest.substr(1);
        if (file.exists(dest)) {
            file.rm(dest);
        }
        file.symlink(src.substr(1), dest);
        return {ok: true}
    }
}


let server = http.listen(manifest.config.port, function (req) {
    console.log(req.method, req.originalUrl);
    if (req.method === 'PUT') {
        let uploadStart = Date.now();
        let m = /^\/([^\/]+)\.js$/.exec(req.originalUrl);
        if (!m) {
            return http.Response.error(404);
        }
        let buf = co.yield(req.buffer()),
            sum = md5(buf), hexsum = sum.toString('hex');
        if (hexsum !== req.headers.get('content-md5')) { // client error
            return response.error(400, 'md5sum mismatch');
        }
        let fullname = `/${m[1]}@${hexsum}.js`;
        let tres = storage.put(req, fullname, buf, sum);
        if (tres.status >= 300) { // not OK
            return tres
        }
        //console.log('upload success');
        tres = storage.copy(fullname, req.originalUrl);
        if (tres.status >= 300) { // not OK
            return tres
        }
        return new http.Response();
    } else if (req.method === 'GET') {
        return storage.get(req);
    } else {
        return http.Response.error(401, 'method not implemented')
    }
});

console.log('server listening on ', server.address());
