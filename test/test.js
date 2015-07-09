import {listen, request, read} from 'module/http.js';
import * as response from 'module/http_response.js';


listen(3000, function (req) {
    var m = /^\/([^/]+)(.+)/.exec(req.url);
    console.log(m[1], m[2]);
    if (m[1] === 'static') {
		return response.file(m[2].substr(1)).setHeader('Content-Type', 'text/javascript').enableGzip();
    } else {
        var tres = request({
            method: 'GET',
            host: m[1],
            path: m[2]
        });
		return response.stream(tres).setStatus(tres.statusCode).setHeaders(tres.headers)
    }
});
