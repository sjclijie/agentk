/**
 * This module helps read and parse file by caching the result and automatically determine whether or not the file
 * content should be read and parsed again.
 *
 * @title file system cache handler
 */

const path = require('path'), fs = require('fs');

const stat = cachedOp(fs.stat),
    read = cachedOp(fs.readFile);


/**
 *
 * @example
 *
 *     import Router from 'router';
 *     import fs_cache from 'fs_cache';
 *     let reader = fs_cache('static');
 *     let content = reader('js/index.js').content;
 *
 * @param {object} [option] optional arguments:
 *
 *   - cached:`number` file modification check iteration in ms, default to 3s
 *   - handler:`function` file content handler
 *
 * @returns {function} reader that accepts a filename and returns an object which contains the result
 */
export default function fs_cache(option = {cached: 3000, handler: Object}) {
    let recheckInterval = option.cached || 3000,
        handler = option.handler || Object;

    const files = {};
    return function (filename, nocache) {
        let now = Date.now();
        if (!nocache && filename in files) {
            let cached = files[filename];
            if (cached.recheck > now) {
                return cached;
            }
            // recheck
            let mtime = +stat(filename).mtime;
            cached.recheck = now + recheckInterval;

            if (mtime !== cached.mtime) { // reload
                cached.mtime = mtime;
                cached.content = handler(read(filename));
            }
            return cached;
        }
        // not cached
        return files[filename] = {
            recheck: now + recheckInterval,
            mtime: +stat(filename).mtime,
            content: handler(read(filename))
        }
    }

}

function cachedOp(method) {
    var cache = {};
    return function (key) {
        return co.yield(key in cache ?
            cache[key] :
            cache[key] = new Promise(function (resolve, reject) {
                method(key, function (err, result) {
                    delete cache[key];
                    if (err)reject(err);
                    else resolve(result);
                })
            }))
    }
}