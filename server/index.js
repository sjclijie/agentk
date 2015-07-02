import * as http from 'module/http.js';
import * as file from 'module/file.js';
import {md5} from 'module/crypto.js';

const storage = co.yield(
    System.import(require('path').join(__dirname, 'module/' + manifest.config.storage.name + '.js'))
)[moduleDefault](manifest.config.storage);

http.listen(manifest.config.port, function (req, res) {
    console.log(req.method, req.url);
    let m = /^\/(\w+)(?:@([0-9a-z]{32}))?\.js$/.exec(req.url);
    if (!m) {
        res.status = 404;
        return;
    }
    if (req.method === 'PUT') {
        let buf = http.read(req),
            sum = md5(buf, 'hex');
        if (sum !== m[2]) { // client error
            res.status = 400;
            res.write('md5sum mismatch');
            return;
        }
        let tres = storage.put(buf, req.url);
        if (tres.statusCode < 300) { // OK
            console.log('upload success');
        } else {
            res.status = tres.statusCode;
            res.stream(tres);
        }
    } else {
        res.status = 400;
    }
});
