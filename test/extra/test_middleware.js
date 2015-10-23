import * as http from '../../src/module/http.js'
import {middleware} from '../../src/module/legacy.js'
import Router from '../../src/module/router.js'

const router = new Router();

router.exact('/foo', middleware(function (req, res, next) {
    if (req.url === '/foo?reject') {
        setTimeout(next, 100, new Error('rejected~'))
    } else if (req.url === '/foo?accept') {
        setTimeout(next, 100)
    } else {
        setTimeout(function () {
            res.end('ended')
        }, 100)
    }
}));

router.all(function (req) {
    return new http.Response(req.method + req.pathname)
});

let server = http.listen(0, router);

let addr = server.address();

const assertEqual = require('assert').strictEqual;

function fetch(url) {
    return co.yield(co.yield(http.fetch('http://127.0.0.1:' + addr.port + url)).text());
}

assertEqual(fetch('/foo?reject'), 'rejected~');
assertEqual(fetch('/foo?accept'), 'GET/foo');
assertEqual(fetch('/foo'), 'ended');

server.close();

