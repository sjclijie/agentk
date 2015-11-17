"use strict";
var http = require('http'),
    url = require('url');

console.log(process.argv);
if (process.argv.length === 2) {
    console.log('usage: node press.js {config_file.json}');
    process.exit(1);
}

var config = JSON.parse(require('fs').readFileSync(process.argv[2]));

var conns = config.conn || 100,
    qps = config.qps || 1000,
    running = 0;
var queries = config.requests;

queries.forEach(function (obj) {
    var parsed = url.parse(obj.url);
    obj.host = parsed.hostname;
    obj.port = parsed.port || 80;
    obj.path = parsed.path;

    if (obj.body) {
        obj.body = new Buffer(typeof obj.body === 'string' ? obj.body : JSON.stringify(obj.body));
    }
});

console.log(
    '\x1b[36m<\x1b[0m  conn -= 10  \x1b[36m>\x1b[0m  conn += 10  \x1b[36mc\x1b[0m  clear\n' +
    '\x1b[36m[\x1b[0m  qps  -= 10  \x1b[36m]\x1b[0m  qps  += 10  \x1b[36mq\x1b[0m  exit');

var agent = http.globalAgent;

agent.maxSockets = 4096;

var sec, reqs, oks, errors, bytesRecv, statusCodes, statusMap, stats, maxqps, start;
clear();

var pending = null;

function run() {
    if (pending) return;
    while (running < conns) {
        var now = Date.now() / 1000 | 0;
        if (sec === now && reqs >= qps) { // qps drain
            return ondrain();
        }

        if (sec !== now) {
            if (reqs > maxqps) maxqps = reqs;

            var msg = '\x1b[s conn:' + conns + ' maxqps:' + qps + ' ' + reqs + ' q/s (' + maxqps + ' max, ' + (oks * 1000 / (Date.now() - start)).toFixed(2) + ' avg) ' +
                (now - startSec) + 's elapsed ' + oks + ' oks( ';
            for (var key in statusMap) {
                msg += key + ':' + stats[+key] + ' ';
            }
            msg += ') ' + errors + ' errors, ' + (bytesRecv / 1048576 | 0) + ' MB recv \x1b[u';
            process.stdout.write(msg);
            sec = now;
            reqs = 0;
        }
        running++;
        reqs++;
        http.request(queries[Math.random() * queries.length | 0], onres).on('error', onerror).end();
    }
}

run();

function ondrain() {
    pending = setTimeout(function () {
        pending = null;
        run();
    }, 1000 - Date.now() % 1000);
}

function onres(tres) {
    oks++;
    statusMap[tres.statusCode] = true;
    stats[tres.statusCode]++;
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

function clear() {
    reqs = sec = oks = errors = bytesRecv = 0;
    maxqps = -1;
    statusCodes = [];
    statusMap = {};
    stats = new Uint32Array(600);
    start = Date.now(), startSec = start / 1000 | 0;
}

process.stdin.resume();
process.stdin.setRawMode(true);
process.stdin.on('data', function (data) {
    switch (data[0]) {
        case 0x63: // c
            clear();
            break;
        case 0x71: // q
            process.stdout.write('\n\n\n');
            process.exit(0);
            break;
        case 0x2c: // ,
        case 0x3C: // <
            if (conns > 10) {
                conns -= 10;
            } else {
                conns = 1;
            }
            break;
        case 0x2E: // .
        case 0x3E: // >
            if (conns < 10) {
                conns = 10;
            } else {
                conns += 10;
            }
            run();
            break;
        case 0x5B:// [
            qps -= 10;
            break;
        case 0x5D:
            qps += 10;
            break;
    }

});

