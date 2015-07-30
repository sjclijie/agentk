import {listen, request, read} from '../src/module/http.js';
import * as response from '../src/module/http_response.js';
import Router from '../src/module/router.js';
import * as view from '../src/module/view.js';

import staticFile from '../src/module/static_file.js';
import * as watcher from '../src/module/q_watcher.js';

watcher.listen(8081);

const route = new Router(function (req) {
    req.timeStart = Date.now();
    watcher.recordOne('request' + req.url, Math.random() * 128 | 0);
});

route.exact('/', function (req) {
    return view.render('index', {process: process, req: req})
});

route.exact('/favicon.ico', function () {
    return response.error(404);
});

route.prefix('/static', staticFile('.', {
    expires: 5 * 60e3, // 5min
    gzip: true
}));

route.match(/^\/([^\/]+)(\/.*)/, function (req, host, path) {
    console.log(host, path);
    var tres = request({
        method: 'GET',
        host: host,
        path: path
    });
    return response.stream(tres).setStatus(tres.statusCode).setHeaders(tres.headers)
});

route.all(function (req) {
    return response.data(req.method + ' ' + req.url + '\n' + JSON.stringify(req.headers, null, 2)).enableGzip();
});

let server = listen(3000, route);
console.log('test listening on', server.address());

