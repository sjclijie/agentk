/**
 *
 */

import {Request} from '../src/module/http';
import staticFile from '../src/module/static_file';

const assert = require('assert'), assertEqual = assert.strictEqual;
let test = new Test('static file');

const stat = require('fs').statSync(__filename),
    etag = stat.mtime.getTime().toString(36) + '-' + stat.size.toString(36);

test.test('defaults', function () {
    let handler = staticFile(__dirname);
    let req = new Request('http://localhost/test_static_file.js');

    let resp = handler(req);
    assertEqual(resp.status, 200, 'bad response status');
    assertEqual(resp.statusText, 'OK', 'bad response status');
    assertEqual(resp.headers.get('cache-control'), 'max-age=0');
    assertEqual(resp.headers.get('content-encoding'), null);
    assertEqual(resp.headers.get('expires'), new Date().toGMTString());
    assertEqual(resp.headers.get('etag'), etag);
});

test.test('expires', function () {
    let handler = staticFile(__dirname, {expires: 3000});
    let req = new Request('http://localhost/test_static_file.js');

    let resp = handler(req);
    assertEqual(resp.status, 200, 'bad response status');
    assertEqual(resp.statusText, 'OK', 'bad response status');
    assertEqual(resp.headers.get('cache-control'), 'max-age=3');
    assertEqual(resp.headers.get('content-encoding'), null);
    assertEqual(resp.headers.get('expires'), new Date(Date.now() + 2999).toGMTString());
    assertEqual(resp.headers.get('etag'), etag);
});

test.test('etag', function () {
    let handler = staticFile(__dirname);
    let req = new Request('http://localhost/test_static_file.js', {
        headers: {
            'if-none-match': etag
        }
    });

    let resp = handler(req);
    assertEqual(resp.status, 304, 'bad response status');
});

test.test('last-modified', function () {
    let handler = staticFile(__dirname);
    let req = new Request('http://localhost/test_static_file.js', {
        headers: {
            'if-modified-since': stat.mtime.toGMTString()
        }
    });

    let resp = handler(req);
    assertEqual(resp.status, 304, 'bad response status');
});


test.test('hash_method', function () {
    let handler = staticFile(__dirname, {
        hash_method: function (content, stat) {
            return '"' + (stat.size ^ content.readUInt32BE(0)) + '"'; // always '/**\r'
        }
    });
    let req = new Request('http://localhost/test_static_file.js', {
        headers: {
            'if-none-match': '"' + (stat.size ^ new Buffer('/**\r').readUInt32BE(0)) + '"'
        }
    });

    let resp = handler(req);
    assertEqual(resp.status, 304, 'bad response status');
});