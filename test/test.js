import {listen, request, read} from '../server/module/http.js';

import Router from '../server/module/router.js';

Router();

listen(3000, function (req, res) {
    var m = /^\/([^/]+)(.+)/.exec(req.url);
    console.log(m[1], m[2]);
    if (m[1] === 'static') {
        res.setHeader('Content-Type', 'text/javascript');
        res.enableGzip();
        res.file(m[2].substr(1));
    } else {
        var tres = request({
            method: 'GET',
            host: m[1],
            path: m[2]
        });
        res.write(read(tres));
    }
});
