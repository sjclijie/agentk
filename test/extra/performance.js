import * as http from '../../src/module/http.js';
console.log()

if (process.argv[2] === 'load') { // child

    setTimeout(function () {
        "use strict";
        const http = require('http');

        let maxConn = (process.argv[4] | 0) || 100, running = 0;
        console.log('< or >: adjust conns; q: exit');

        let agent = http.globalAgent;

        agent.maxSockets = 4096;

        const options = {
            method: 'GET',
            host: '127.0.0.1',
            port: process.env.server_port,
            path: '/',
            agent: agent
        };

        let sec = 0;
        let reqs = 0;

        function run() {
            while (running < maxConn) {
                running++;
                reqs++;
                let now = Date.now() / 1000 | 0;
                if (sec !== now) {
                    process.stdout.write('\x1b[s ' + reqs + ' q/s ' + maxConn + ' conns\x1b[u');
                    sec = now;
                    reqs = 0;
                }
                http.request(options, onres).end();
            }
        }

        run();

        function onres(tres) {
            tres.on('data', Boolean).on('end', function () {
                running--;
                run();
            })
        }

        process.stdin.resume();
        process.stdin.setRawMode(true);
        process.stdin.on('data', function (data) {
            if (data[0] === 0x71) {
                process.stdout.write('\n');
                process.exit(0)
            } else if (data[0] === 44) { // --
                if (maxConn > 10) {
                    maxConn -= 10;
                } else {
                    maxConn = 0;
                }
            } else if (data[0] === 46) { // ++
                maxConn += 10;
                run();
            }
        });
    });
} else {

    let ok = new http.Response('foo bar');

    ok.headers.append('Cache-Control', 'no-cache');
    ok.headers.append('Server', 'blahblah');

    let server = http.listen(0, function (req) {
        for (let i = 0; i < 5; i++) {
            co.sleep(10);
        }
        return ok;
    }, '127.0.0.1', 1024);

    console.log('performance: server listening at ', server.address());

    require('child_process').spawn(process.execPath, [
        '--harmony',
        require('path').join(__dirname, '../../index.js'),
        'load',
        __filename
    ], {
        env: {
            server_port: server.address().port
        },
        stdio: 'inherit'
    }).on('exit', function () {
        server.close()
    });
}
