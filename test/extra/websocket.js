import * as ws from '../../src/module/websocket.js';

let server = ws.listen(881, function (req) {
    console.log('ws:', req.method, req.pathname);
    if (req.pathname !== '/foo/bar') {
        return req.reject();
    }
    let ws = req.accept();
    ws.send('hello world');

    ws.on('message', function (msg, type) {
        console.log('RECV', type, msg);
        if (type === 'text') {
            if (msg === 'close') {
                ws.close();
            } else if (msg.substr(0, 5) === 'eval ') {
                ws.send((0, eval)(msg.substr(5)));
            }
        } else if (type === 'buffer') {
            ws.send(require('util').inspect(msg));
        }

    }).on('close', function (code, reason) {
        console.log('ws closed', code, reason)
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