/**
 * Helper for using [Watcher](http://watcher.corp.qunar.com/).
 *
 * This module helps pushing monitor data to watcher system.
 *
 * @title Qunar Watcher module
 */

import * as http from 'http.js';
import * as channel from 'channel.js';

/**
 * metric prefix of the log entry, see the [wiki](http://wiki.corp.qunar.com/pages/viewpage.action?pageId=74958076#%E6%95%B0%E6%8D%AE%E6%94%B6%E9%9B%86-Watcher%E6%8C%87%E6%A0%87%E5%91%BD%E5%90%8DOpsWiki%3AWatcher%E6%8C%87%E6%A0%87%E5%91%BD%E5%90%8D)
 * to get the proper metric prefix
 *
 * @example
 *
 *     watcher.prefix = 's.hotel.ued.xxx';
 *
 * @type {string}
 */
export let prefix = 't';

/**
 * remote server to push the log to, see the [wiki](http://wiki.corp.qunar.com/pages/viewpage.action?pageId=74958076#%E6%95%B0%E6%8D%AE%E6%94%B6%E9%9B%86-Watcher%E6%8C%87%E6%A0%87%E5%91%BD%E5%90%8DOpsWiki%3AWatcher%E6%8C%87%E6%A0%87%E5%91%BD%E5%90%8D)
 * to get the proper remote server
 *
 * @example
 *
 *     watcher.server = 'qmon-hotel.corp.qunar.com';
 *
 * @type {string}
 */
export let server = 'qmon-beta.corp.qunar.com';

export let port = 2013;

let sendingTimer = null, peers = null, peerPort = 0;

let last = [{}, {}, {}], counts = {}, sums = {}, values = {}, nextMin = Date.now() / 60e3 | 0;

// callbacks for registered metrics
const registeredMetrics = {};

/**
 * Set up data combination and calculation for multiple servers.
 *
 * @example
 *
 *     q_watcher.setupPeers(['l-qzz1.fe.dev.cn6', 'l-qzz2.fe.dev.cn6'], require('os').hostname(), 8012);
 *
 * @param {Array} hosts hostnames of all servers
 * @param {string} localhost this server's hostname
 * @param {number} [port] port number to communicate with other servers, default to 8012
 */
export function setupPeers(hosts, localhost, port) {
    let idx = hosts.indexOf(localhost);
    if (idx === -1) {
        throw new Error('localhost not in host list');
    }
    hosts.splice(idx, 1);
    peers = hosts;
    peerPort = port || 8012;
    http.listen(peerPort, function (req) {
        return http.Response.json(channel.query('watcher'));
    }, localhost);
}


channel.registerProvider('watcher', function () {
    if (sendingTimer) { // scheduling
        clearTimeout(sendingTimer);
        sendingTimer = null;
    }
    return last;
}, true);

setTimeout(trigger, ++nextMin * 60e3 - Date.now()).unref();


function trigger() {
    setTimeout(trigger, ++nextMin * 60e3 - Date.now()).unref();

    for (let key in registeredMetrics) {
        values[key] = registeredMetrics[key]();
    }
    last = [values, counts, sums];
    values = {};
    counts = {};
    sums = {};

    sendingTimer = setTimeout(sendAll, Math.random() * (peers ? peers.length + 1 : 1) * 3000);
}

const ohttp = require('http'), onet = require('net');


function sendAll() {
    sendingTimer = null;
    // fetch all and send
    co.run(function () {
        let allResults = channel.query('watcher');
        if (peers) {
            allResults = Array.prototype.concat.apply(allResults, co.yield(Promise.all(peers.map(function (peer) {
                return new Promise(function (resolve) {
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
                            resolve(JSON.parse(str));
                        }).on('error', function (err) {
                            console.error(err.stack);
                            resolve(null);
                        });
                    }).on('error', function (err) { // cannot contact peer
                        console.error(err.stack);
                        resolve(null);
                    }).end();
                });
            }))));
        }

        //console.log('all results', allResults);
        let allValues = {}, allCounts = {}, allSums = {};
        for (let tuple of allResults) {
            if (!tuple) continue;
            let values = tuple[0], counts = tuple[1], sums = tuple[2];
            for (let key in  values) {
                key in allValues || (allValues[key] = values[key]);
            }
            for (let key in counts) {
                allCounts[key] = (counts[key] | 0) + (allCounts[key] | 0);
            }

            for (let key in sums) {
                allSums[key] = +sums[key] + (key in allSums ? +allSums[key] : 0);
            }
        }
        let buf = '', ts = Date.now() / 1000 | 0;
        for (let key in allValues) {
            buf += prefix + '.' + key + ' ' + allValues[key] + ' ' + ts + '\n';
        }

        for (let key in allCounts) {
            buf += prefix + '.' + key + '_Count ' + allCounts[key] + ' ' + ts + '\n';
        }

        for (let key in allSums) {
            buf += prefix + '.' + key + '_Time ' + (allSums[key] / allCounts[key] | 0) + ' ' + ts + '\n';
        }

        onet.connect({
            port: port,
            host: server
        }).on('error', onerr).end(buf);
    }).then(null, onerr);
    function onerr(err) {
        console.error(err.stack);
    }
}

/**
 * Increase a record's count by 1, a time can be supplied
 *
 * @example
 *
 *     q_watcher.add('request_total');
 *     q_watcher.add('request_cost', Date.now() - timeStart);
 *
 * @param {string} name last name of the monitor record
 * @param {number} [time] time of the monitor record
 */
export function add(name, time) {
    let key = name.replace(/[\W$]/g, '_');
    counts[key] = key in counts ? (counts[key] | 0) + 1 : 1;

    if (arguments.length > 1) { // has time
        sums[key] = (sums[key] || 0) + time;
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
export function set(name, number) {
    let key = name.replace(/[\W$]/g, '_');
    values[key] = number | 0;
}


/**
 * Increase a record's count by a varible number
 *
 * @example
 *
 *     q_watcher.addMulti('foobar', 30)
 *
 * @param {string} name last name of the monitor record
 * @param {number} count value to be increased
 */
export function addMulti(name, count) {
    let key = name.replace(/[\W$]/g, '_');
    counts[key] = key in counts ? (counts[key] | 0) + count : count;
}

/**
 * Register a callback for a metric. The callback will be called every one minute for the current value.
 *
 * @param {string} name last name of the metric
 * @param {Function} cb callback that will be queried for the value of the metric
 */
export function register(name, cb) {
    let key = name.replace(/[\W$]/g, '_');
    registeredMetrics[key] = cb;
}