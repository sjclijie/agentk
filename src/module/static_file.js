/**
 *
 * @title static file request handler
 */

import * as response from 'http_response.js';
import * as zlib from 'zlib.js';

const path = require('path'), fs = require('fs');

const stat = cachedOp(fs.stat),
    read = cachedOp(fs.readFile);

/**
 * filename extension to mime type map
 *
 * @type {object}
 */
export const mimeTypes = {
    css: 'text/css',
    gif: 'image/gif',
    htm: 'text/html',
    html: 'text/html',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    js: 'text/javascript',
    json: 'application/json',
    png: 'image/png'
};


/**
 *
 * @example
 *
 *     import Router from 'router.js';
 *     import staticFile from 'static_file.js';
 *     let route = new Router();
 *     route.prefix('/static/', staticFile('static'))
 *
 *
 * @param {string} directory absolute path or relative to working directory
 * @param {object} [option] optional arguments:
 *
 *   - no_cache:`boolean` disable file cache, default to false
 *   - expires:`number` duration before expiration in ms, default to 0
 *   - cached:`number` file modification check iteration in ms, default to 3s
 *   - gzip:`boolean` enable gzip, default to false
 *
 * @returns {function} router handle
 */
export default function staticFile(directory, option) {
    directory = path.resolve(directory);

    const useCache = !option || !option.no_cache;
    const cached = useCache && {}; // path->{content:buffer,etag:string,lm:string,recheck:number,headers:object}
    const expires = (option && option.expires) | 0;
    const gzip = !!(option && option.gzip);
    const recheckInterval = (option ? option.cached | 0 : 3000) || 3000, cc = 'max-age=' + (expires / 1000 | 0);


    return function (req) {
        const filename = path.resolve(directory + req.pathname),
            headers = req.headers;

        const useGzip = gzip && 'accept-encoding' in headers && headers['accept-encoding'].indexOf('gzip') !== -1;

        let cache;
        if (useCache
            && filename in cached
            && headers['cache-control'] !== 'no-cache'
            && (cache = cached[filename]).recheck > Date.now()) { // found cache
            if (headers['if-none-match'] === cache.etag || headers['if-modified-since'] === cache.lm) {
                return response.error(304);
            }
            if (useGzip) {
                return response.data(cache.gzipped).setHeaders(cache.headers).setHeader('Content-Encoding', 'gzip');
            } else {
                return response.data(cache.content).setHeaders(cache.headers);
            }
        }
        // do not use cache
        const stats = stat(filename),
            mtime = stats.mtime,
            mtime_ms = +mtime,
            mtime_str = mtime.toGMTString(),
            etag = mtime_ms.toString(36) + '-' + stats.size.toString(36);
        if (headers['if-modified-since'] === mtime_str) { // not changed
            return response.error(304);
        }
        const content = read(filename);
        cache = {
            content: content,
            etag: etag,
            lm: mtime_str,
            recheck: mtime_ms + recheckInterval,
            headers: {
                'Cache-Control': cc,
                'Expires': new Date(Date.now() + expires).toGMTString(),
                'ETag': etag,
                'Last-Modified': mtime_str,
                'Content-Type': mimeTypes[path.extname(filename).substr(1)] || 'application/octet-stream'
            }
        };
        if (useCache) {
            cached[filename] = cache;
        }
        if (gzip) {
            cache.gzipped = zlib.gzip(content);
            if (useGzip) {
                return response.data(cache.gzipped).setHeaders(cache.headers).setHeader('Content-Encoding', 'gzip');
            }
        }
        return response.data(content).setHeaders(cache.headers);
    };
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