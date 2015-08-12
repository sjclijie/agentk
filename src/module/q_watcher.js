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

let sendingTimer = null, peers = null, peerPort = 0;

let last = '', current = '', nextMin = Date.now() / 30e3 | 0;

/**
 * Set up data combination and calculation for multiple servers.
 *
 * @param {Array} hosts hostnames of all servers
 * @param {string} localhost this server
 * @param {number} port
 */
export function setupPeers(hosts, localhost, port) {
    let idx = hosts.indexOf(localhost);
    if (idx === -1) {
        throw new Error('localhost not in host list');
    }
    hosts.splice(idx, 1);
    peers = hosts;
    peerPort = port;
    http.listen(port, function (req) {
        return response.data(channel.query('watcher').join(''));
    }, localhost);
}


channel.registerProvider('watcher', function () {
    if (sendingTimer) { // scheduling
        clearTimeout(sendingTimer);
        sendingTimer = null;
    }
    return last;
}, true);

setTimeout(trigger, ++nextMin * 30e3 - Date.now()).unref();


function trigger() {
    setTimeout(trigger, ++nextMin * 30e3 - Date.now()).unref();

    last = current;
    current = '';
    sendingTimer = setTimeout(sendAll, Math.random() * (peers ? peers.length + 1 : 1) * 3000);
}

const ohttp = require('http');

function sendAll() {
    sendingTimer = null;
    // fetch all and send
    co.run(function () {
        let allResults = channel.query('watcher');
        if (peers) {
            co.yield(Promise.all(peers.map(function (peer) {
                return new Promise(function (resolve, reject) {
                    ohttp.request({
                        method: 'GET',
                        path: '/',
                        host: peer,
                        port: peerPort,
                        headers: {
                            'Connection': 'close'
                        }
                    }, function (tres) {
                        let str = '';
                        tres.on('data', function (buf) {
                            str += buf;
                        }).on('end', function () {
                            allResults += str;
                            resolve();
                        }).on('error', function (err) {
                            console.error(err.stack);
                            resolve();
                        });
                    }).on('error', function (err) { // cannot contact peer
                        console.error(err.stack);
                        resolve();
                    }).end();
                });
            })));
        }
        console.log(allResults);
    }).done();
}

export function add(name, duration, timeStamp) {
    let argLen = arguments.length;
    current += prefix + name.replace(/[\W$]/g, '_') + ' ' + (argLen < 2 ? 0 : duration | 0) + ' ' + ((argLen < 3 ? Date.now() : timeStamp) / 1000 | 0) + '\n'
}
