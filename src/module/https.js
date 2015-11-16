import {_handler} from 'http';
const ohttps = require('https');


export function listen(options, port, cb, host, backlog) {
    return co.promise(function (resolve, reject) {
        ohttps.createServer(options, _handler(cb)).listen(port, host, backlog, function () {
            resolve(this)
        }).on('error', reject);
    });
}