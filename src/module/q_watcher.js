/**
 * Helper for using [Watcher](http://watcher.corp.qunar.com/).
 *
 * This module helps pushing monitor data to watcher system.
 *
 * @title Qunar Watcher module
 */

import {listen as _listen} from 'http.js';
import {data} from 'http_response.js';

let last = '', current = {}, sums = {}, lastMin = 0;

function updateTime() {
    let minute = Date.now() / 60e3 | 0;
    if (minute === lastMin) return;
    let buf = '';
    for (let i = 0, keys = Object.keys(sums), L = keys.length; i < L; i++) {
        let key = keys[i];
        buf += key + '_Value=' + (sums[key] / current[key + '_Count'] | 0) + '\n';
    }
    for (let i = 0, keys = Object.keys(current), L = keys.length; i < L; i++) {
        let key = keys[i];
        buf += key + '=' + current[key] + '\n';
    }

    last = buf;
    lastMin = minute;
    current = {};
    sums = {};
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
 * @param {number} time optional, time of the monitor record
 */
export function recordOne(name, time) {
    incrRecord(name, 1);

    if (arguments.length > 1) { // has time
        let key = name.replace(/[\W$]/g, '_');
        sums[key] = key in sums ? sums[key] + time : time;
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
    updateTime();

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
    updateTime();
    let key = name.replace(/[\W$]/g, '_') + '_Count';
    current[key] = key in current ? current[key] + count : count;
}


/**
 * start background web service
 *
 * @param {number} port HTTP port number to listen to
 */
export function listen(port) {
    let server = _listen(port, function (req) {
        updateTime();
        return data(last);
    });
    server.unref();
}