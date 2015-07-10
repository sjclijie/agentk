"use strict";
const http = require('http');

const maxConn = +process.argv[4];

http.globalAgent.maxSockets = maxConn;

const options = {
    method: 'GET',
    host: process.argv[2],
    port: process.argv[3],
    path: '/'
};

const startTime = Date.now();
let reqs = 0;

for (let i = 0; i < maxConn; i++) {
    run();
}

function run() {
    reqs++;
    http.request(options, onres).end();
}

function onres(tres) {
    tres.on('data', Boolean).on('end', run)
}


process.stdin.resume();
process.stdin.setRawMode(true);
process.stdin.on('data', function (data) {
    if (data[0] === 0x71) {
        let ms = Date.now() - startTime;
        console.log('%d ms, %d requests sent (%d q/s)', ms, reqs, reqs * 1000 / ms | 0);
        process.exit(0)
    }
});