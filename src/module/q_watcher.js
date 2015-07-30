/**
 * Helper for using [Watcher](http://watcher.corp.qunar.com/).
 *
 * This module helps pushing monitor data to watcher system.
 *
 * @title Qunar Watcher module
 */

import {listen as _listen} from 'http.js';
import * as response from 'http_response.js';
import * as channel from 'channel.js';

let last = [{}, {}], current = {}, sumTime = {}, nextMin = Date.now() / 60e3 | 0;

channel.registerProvider('watcher', function () {
    return last;
}, true);

setTimeout(updateTime, ++nextMin * 60e3 - Date.now()).unref();

function updateTime() {
    setTimeout(updateTime, ++nextMin * 60e3 - Date.now()).unref();

    last = [current, sumTime];
    current = {};
    sumTime = {};
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
export function listen(port) {
    _listen(port, function (req) {
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
    }).unref();
}

