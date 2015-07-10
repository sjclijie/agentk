import * as http from '../src/module/http.js';
import * as response from '../src/module/http_response.js';
import * as file from '../src/module/file.js';
import {md5} from '../src/module/crypto.js';

const storage = co.yield(
    System.import(require('path').join(__dirname, '../src/module/' + manifest.config.storage.name + '.js'))
)[moduleDefault](manifest.config.storage);

let server = http.listen(manifest.config.port, function (req) {
    console.log(req.method, req.url);
    let m = /^\/([^\/]+)\.js$/.exec(req.url);
    if (!m) {
        return response.error(404);
    }
    if (req.method === 'PUT') {
        let buf = http.read(req),
            sum = md5(buf, 'hex');
        if (sum !== req.headers['content-md5']) { // client error
            return response.error(400, 'md5sum mismatch');
        }
        let fullname = `/${m[1]}@${sum}.js`;
        let tres = storage.put(buf, fullname);
        if (tres.statusCode >= 300) { // not OK
            return response.stream(tres).setStatus(tres.statusCode);
        }
        console.log('upload success');
        tres = storage.copy(fullname, req.url);
        if (tres.statusCode >= 300) { // not OK
            return response.stream(tres).setStatus(tres.statusCode);
        }
        return response.ok();
    } else {
        return response.error(401, 'method not implemented')
    }
});

console.log('server listening on ', server.address());
