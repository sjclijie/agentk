/**
 *
 * @title static file request handler
 */

import {Response} from 'http.js';
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
 *   - gzip:`boolean` enable gzip, default to true
 *   - gzip_min_len:`number` mininum length of file to be gzipped, default to 1K
 *
 * @returns {function} router handle
 */
export default function staticFile(directory, option) {
    const NOT_MODIFIED = Response.error(304),
        NOT_FOUND = Response.error(404);
    const GZIP = /\bgzip\b/;

    directory = path.resolve(directory);

    let useCache = true,
        expires = 0,
        recheckInterval = 3000,
        useGzip = true,
        gzipMinLen = 1024,
        cc = 'max-age=0';
    if (option) {
        useCache = 'no_cache' in option ? !option.no_cache : useCache;
        expires = 'expires' in option ? option.expires | 0 : expires;
        recheckInterval = 'cached' in option ? option.cached | 0 : recheckInterval;
        useGzip = 'gzip' in option ? !!option.gzip : useGzip;
        gzipMinLen = useGzip && 'gzip_min_len' in option ? option.gzip_min_len | 0 : gzipMinLen;
        cc = useCache ? 'max-age=' + (expires / 1000 | 0) : 'no-cache';
    }

    const cache = useCache ? function () {
        const files = {};

        return {
            match: function (req) {
                const headers = req.headers;
                if (req.filename in files && headers.get('cache-control') !== 'no-cache') { // uses cache
                    let cached = files[filename];
                    if (cached.recheck > Date.now()) { // cache is fine
                        if (headers.get('if-none-match') === cached.etag ||
                            headers.get('if-modified-since') === cached.lm) {
                            return NOT_MODIFIED
                        }
                        return req.acceptsGzip ? cached.gzipped_response : cached.response;
                    }
                }
            },
            add: function (req, content, options, mtime) {
                let entry = files[req.filename] = {
                    etag: options.headers.ETag,
                    lm: options.headers['Last-Modified'] = mtime.toGMTString(),
                    recheck: +mtime + recheckInterval
                };

                options.headers.Expires = new Date(Date.now() + expires).toGMTString();

                entry.response = new Response(content, options);

                //'Expires': new Date(Date.now() + expires).toGMTString(),
                //    'ETag': etag,
                //    'Last-Modified': mtime_str,

                if (useGzip) {
                    if (content.length >= gzipMinLen) {
                        options.headers['Content-Encoding'] = 'gzip';
                        entry.gzipped_response = new Response(zlib.gzip(content), options);
                    } else {
                        entry.gzipped_response = entry.response;
                    }
                }
                return req.acceptsGzip ? entry.gzipped_response : entry.response;
            }
        }
    }() : {
        match: function () {
        },
        add: function (req, content, options) {
            if (req.acceptsGzip && content.length > gzipMinLen) {
                options.headers['Content-Encoding'] = 'gzip';
                content = zlib.gzip(content);
            }
            return new Response(content, options)
        }
    };


    return function (req) {
        let filename = req.filename = path.resolve(directory + req.pathname);
        req.acceptsGzip = useGzip && GZIP.test(req.headers.get('accept-encoding'));

        let response = cache.match(req);
        if (response) return response;

        // cache not matched
        let stats;
        try {
            stats = stat(filename);
        } catch (e) {
            return NOT_FOUND;
        }
        const mtime = stats.mtime,
            mtime_str = mtime.toGMTString(),
            etag = (+mtime).toString(36) + '-' + stats.size.toString(36);

        if (req.headers.get('if-modified-since') === mtime_str ||
            req.headers.get('if-none-match') === etag) { // not changed, won't read
            return NOT_MODIFIED
        }

        // will read and cache
        const content = read(filename), options = {
            headers: {
                'ETag': etag,
                'Cache-Control': cc,
                'Content-Type': mimeTypes[path.extname(filename).substr(1)] || 'application/octet-stream'
            }
        };

        return cache.add(req, content, options, mtime);

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