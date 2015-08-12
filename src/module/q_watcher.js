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

let last = [{}, {}], current = {}, sumTime = {}, nextMin = Date.now() / 60e3 | 0;

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
        if (sendingTimer) { // scheduling
            clearTimeout(sendingTimer);
            sendingTimer = null;
        }
        return response.json(channel.query('watcher'));
    }, localhost);
}


channel.registerProvider('watcher', function () {
    return last;
}, true);

setTimeout(trigger, ++nextMin * 60e3 - Date.now()).unref();


function trigger() {
    setTimeout(trigger, ++nextMin * 60e3 - Date.now()).unref();

    last = [current, sumTime];
    current = {};
    sumTime = {};

    if (peers) {
        sendingTimer = setTimeout(sendAll, Math.random() * 3000);
    } else {
        send();
    }
}

const ohttp = require('http');

function sendAll() {
    sendingTimer = null;
    // fetch all and send
    co.run(function () {
        let peerResults = co.yield(Promise.all(peers.map(function (peer) {
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
                        console.log(peer + ' returns ' + str);
                        resolve(JSON.parse(str))
                    }).on('error', function () {
                        resolve(null);
                    });
                }).on('error', function (err) { // cannot contact peer
                    resolve(null);
                }).end();
            });
        })));
        let allResults = Array.prorotype.concat.apply(channel.query('watcher'), peerResults);
        console.log('all results', allResults);
    });
}

function send() {

}

/**
 * Increase a record's count by 1, a time can be supplied
 *
 * @example
 *
 *     q_watcher.recordOne('request_total');
 *     q_watcher.recordOne('request_cost', Date.now() - timeStart);
 *
 * @param {string} name last name of the monitor record
 * @param {number} [time] time of the monitor record
 */
export function recordOne(name, time) {
    incrRecord(name, 1);

    if (arguments.length > 1) { // has time
        let key = name.replace(/[\W$]/g, '_');
        sumTime[key] = (sumTime[key] || 0) + time;
    }
}

/**
 * Set a record's number
 *
 * @example
 *
 *     q_watcher.recordSize('Thread Count', 100)
 *
 * @param {string} name last name of the monitor record
 * @param {number} number number to be set to
 */
export function recordSize(name, number) {
    let key = name.replace(/[\W$]/g, '_') + '_Value';
    current[key] = number | 0;
}


/**
 * Increase a record's count by a varible number
 *
 * @example
 *
 *     q_watcher.incrRecord('foobar', 30)
 *
 * @param {string} name last name of the monitor record
 * @param {number} count value to be increased
 */
export function incrRecord(name, count) {
    let key = name.replace(/[\W$]/g, '_') + '_Count';
    current[key] = (current[key] | 0) + count;
}


/**
 * start background web service
 *
 * @param {number} port HTTP port number to listen to
 */
export function _listen(port) {
    listen(port, function (req) {
        if (req.url !== '/qmonitor.jsp') return response.error(404);

        const results = channel.query('watcher'),
            self = results.pop(),
            allNumbers = self[0], allSums = self[1];

        for (let pair of results) {
            let numbers = pair[0], sums = pair[1];
            for (let key in numbers) {
                allNumbers[key] = (allNumbers[key] | 0) + numbers[key];
            }
            for (let key in sums) {
                allSums[key] = (allSums[key] | 0) + sums[key];
            }
        }

        let buf = '';
        for (let key in allSums) {
            buf += key + '_Time=' + (allSums[key] / allNumbers[key + '_Count'] | 0) + '\n';
        }
        for (let key in allNumbers) {
            buf += key + '=' + allNumbers[key] + '\n';
        }

        return response.data(buf);
    });
}

