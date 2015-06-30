import {listen, request, read} from '../module/http.js'; // normal
import * as file from '../module/file.js';

listen(3000, function (req, res) {
    var m = /^\/([^/]+)(.+)/.exec(req.url);
    console.log(m[1], m[2]);
    if (m[1] === 'static') {
        res.setHeader('Content-Type', 'text/javascript');
        res.write(file.read(__dirname + m[2]));
    } else {
        var tres = request({
            method: 'GET',
            host: m[1],
            path: m[2]
        });
        res.write(read(tres));
    }
});