"use strict";
const http = require('http');

let maxConn = (process.argv[4] | 0) || 100, running = 0;
console.log('< or >: adjust conns; q: exit');

let agent = http.globalAgent;

agent.maxSockets = 4096;

const options = {
    method: 'GET',
    host: '127.0.0.1',
    port: process.env.server_port || '80',
    path: process.env.server_path || '/',
    agent: agent
};

let sec = 0;
let reqs = 0;
let oks = 0;
let errors = 0;
let bytesRecv = 0;

function run() {
    while (running < maxConn) {
        running++;
        reqs++;
        let now = Date.now() / 1000 | 0;
        if (sec !== now) {
            process.stdout.write('\x1b[s ' + reqs + ' q/s ' + maxConn + ' conns, ' + oks + ' oks, ' + errors + ' errors, ' + (bytesRecv >> 20) + ' MB recv \x1b[u');
            sec = now;
            reqs = 0;
        }
        http.request(options, onres).on('error', onerror).end();
    }
}

run();

function onres(tres) {
    tres.on('data', function (data) {
        bytesRecv += data.length
    }).on('end', function () {
        running--;
        run();
    })
}

function onerror() {
    errors++;
    running--;
    run();
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

