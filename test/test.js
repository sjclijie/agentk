import {listen, request, read} from '../src/module/http.js';
import * as response from '../src/module/http_response.js';
import Router from '../src/module/router.js';

const route = new Router(function (req) {
    req.timeStart = Date.now();
});

route.exact('/favicon.ico', function () {
    return response.error(404);
});

route.prefix('/static', function (req) {
    console.log(req.timeStart, req.url);
    return response.file(req.url.substr(1)).setHeader('Content-Type', 'text/javascript').enableGzip();
});

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
