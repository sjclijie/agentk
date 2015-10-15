/**
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
 *     let content = reader('js/index.js');
 *
 *
 * @param {string} directory absolute path or relative to working directory
 * @param {object} [option] optional arguments:
 *
 *   - cached:`number` file modification check iteration in ms, default to 3s
 *   - handler:`string` file content handler
 *
 * @returns {function} reader
 */
export default function fs_cache(option) {
    let recheckInterval = 3000,
        handler = Object;
    if (option) {
        recheckInterval = 'cached' in option ? option.cached | 0 : recheckInterval;
        handler = 'handler' in option ? option.handler : handler;
    }

    const files = {};
    return function (filename, nocache) {
        let now = Date.now();
        if (!nocache && filename in files) {
            let cached = files[filename];
            if (cached.recheck) {
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