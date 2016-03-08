import * as ws from '../../src/module/websocket.js';

let server = ws.listen(881, function (req) {
    //console.log('ws:', req.method, req.pathname, req.headers._entries);
    if (req.pathname === '/foo/bar/baz') {
        return req.reject();
    }
    let ws = req.accept();
    ws.on('message', function (msg) {
        //console.log('RECV', buffer);
        if (typeof msg === 'string') {
            if (msg.substr(0, 5) === 'eval ') {
                ws.send((0, eval)(msg.substr(5)) + '')
            } else if (msg.substr(0, 6) === 'print ') {
                console.log(msg.substr(6));
            }
            //
        }
    }).on('close', function () {
        console.log('ws closed')
    })
});

console.log('ws server listening on', server.address());

import * as http from '../../src/module/http.js';

http.listen(880, function (req) {
    console.log(req.method, req.url);
    if (req.pathname === '/')
        return http.Response.file(__dirname + '/test_websocket.html')
});

console.log('visit http://localhost:880/');