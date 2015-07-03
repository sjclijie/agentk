"use strict";

import '../server/module/http.js'; // simply import
import http0,* as http from '../server/module/http.js'; // namespace
//import http0 from '../module/http.js'; // default
import {listen, request, read} from '../server/module/http.js'; // normal
import * as file from '../server/module/file.js';

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

    for (; ;);
    for (let x of [http0, request]) {
        request(read);
        for (let {read} of http0) {
            request(read);
        }
    }
    for (let x in http) {
        read(!x);
        for (let {request,read} in http0) {
            request(read, http0);
        }
    }
    for (let x = 0; x in request(read); x++) {
        createServer(x, read)
    }
    {
        let http0 = createServer;
        http0++;
        request = http0;
        [http0, request] = [0, read];
        let {a, b: {c,d:[e,{request}]}} = createServer(http0);
        request(createServer);
    }

    function xxx() {
        test:  while (http0) {
            let read = 0;
            http0--;
            read(http0, (x)=> {
                x++;
                x && 0;
                request(createServer);
                new createServer(x)
            }, (x)=> x + read, (x)=>request);
            break test;
            continue test;
            throw request;
        }
        do {
            createServer(read, this)
        } while (http0);
        test1: switch (http0) {
            case request:
                createServer(read, `a${http0} and ${request(read)} xxx`);
                break;
            case read:
            {
                String.raw`foo bar ${http0 + 0}`;
                createServer(request);
                break;
            }

            default:
                request(createServer);
                break;
        }
        let [a, b, ...read] = [...http0];
        return createServer(read), http0;
    }

    function* m2() {
        try {
            request(read)
        } catch (read) {
            read(http0 ? request : createServer);
        } finally {
            read(request);
            return;
        }
        request(read);
        let x = function *(read, ...what) {
            yield request(read);
        };
    }
});


// a.js
export default 0;

export let x = 1;

// c.js
System.import('a.js').then(function (a) {
    console.log(a); // 0 ?
    console.log(a.x); // ???
});