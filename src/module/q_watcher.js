/**
 * Helper for using [Watcher](http://watcher.corp.qunar.com/).
 *
 * This module helps pushing monitor data to watcher system.
 *
 * @title Qunar Watcher module
 */

import * as http from 'http.js';
import * as response from 'http_response.js';
import * as channel from 'channel.js';

/**
 * metric prefix of the log entry, see the [wiki](http://wiki.corp.qunar.com/pages/viewpage.action?pageId=74958076#%E6%95%B0%E6%8D%AE%E6%94%B6%E9%9B%86-Watcher%E6%8C%87%E6%A0%87%E5%91%BD%E5%90%8DOpsWiki%3AWatcher%E6%8C%87%E6%A0%87%E5%91%BD%E5%90%8D)
 * to get the proper metric prefix
 *
 * @demo
 *
 *     watcher.prefix = 's.hotel.ued.xxx';
 *
 * @type {string}
 */
export let prefix = 't.agentk';

/**
 * remote server to push the log to, see the [wiki](http://wiki.corp.qunar.com/pages/viewpage.action?pageId=74958076#%E6%95%B0%E6%8D%AE%E6%94%B6%E9%9B%86-Watcher%E6%8C%87%E6%A0%87%E5%91%BD%E5%90%8DOpsWiki%3AWatcher%E6%8C%87%E6%A0%87%E5%91%BD%E5%90%8D)
 * to get the proper remote server
 *
 * @demo
 *
 *     watcher.server = 'qmon-hotel.corp.qunar.com';
 *
 * @type {string}
 */
export let server = 'qmon-beta.corp.qunar.com';
export let port = 2015;

let sendingTimer = null;

let last = '', current = '', nextMin = Date.now() / 20e3 | 0;

channel.registerProvider('watcher', function () {
    if (sendingTimer) { // scheduling
        clearTimeout(sendingTimer);
        sendingTimer = null;
    }
    return last;
}, true);

setTimeout(trigger, ++nextMin * 20e3 - Date.now()).unref();

function trigger() {
    setTimeout(trigger, ++nextMin * 20e3 - Date.now()).unref();
    last = current;
    current = '';
    sendingTimer = setTimeout(sendAll, 1000 + Math.random() * 3000);
}

const dgram = require('dgram');

function sendAll() {
    sendingTimer = null;
    // fetch all and send
    co.run(function () {
        let allResults = channel.query('watcher').join('');
        if (!allResults) return;
        console.log(allResults);
        let socket = dgram.createSocket('udp4');
        let buf = new Buffer(allResults);
        co.sync(socket, send, buf, 0, buf.length, port, server);
        socket.close();
    }).then(null, function (err) {
        console.error(err.stack);
    });
}

export function add(name, duration, timeStamp) {
    let argLen = arguments.length;
    current += `${prefix}.${name.replace(/[\W$]/g, '_')} ${(argLen < 2 ? 0 : duration | 0)} ${((argLen < 3 ? Date.now() : timeStamp) / 1000 | 0)}\n`;
}
