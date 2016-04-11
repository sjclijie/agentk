/**
 *
 * @title static file request handler
 */

import {Response} from 'http';
import * as zlib from 'zlib';

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
    png: 'image/png',
    xml: 'application/xml'
};

import LRUCache from 'lru_cache';

/**
 *
 * @example
 *
 *     import Router from 'router';
 *     import staticFile from 'static_file';
 *     let route = new Router();
 *     route.prefix('/static/', staticFile('static'))
 *
 *
 * @param {string} directory absolute path or relative to working directory
 * @param {object} [option] optional arguments:
 *
 *   - expires:`number` duration before expiration in ms, default to 0
 *   - cached:`number` file modification check iteration in ms, default to 3s
 *   - gzip:`boolean` enable gzip, default to true
 *   - gzip_min_len:`number` mininum length of file to be gzipped, default to 1K
 *   - hash_method:`function` method used to calculate etag
 *   - cache_capacity:`number` maximum of file cached, defaults to 300
 *
 * @returns {function} router handle
 */
export default function staticFile(directory, option) {
    const NOT_MODIFIED = Response.error(304),
        NOT_FOUND = Response.error(404);
    const GZIP = /\bgzip\b/;

    directory = path.resolve(directory);

    let expires = 0,
        recheckInterval = 3000,
        useGzip = true,
        gzipMinLen = 1024,
        hash_method = hash,
        cache_capacity = 300,
        cc = 'max-age=0';
    if (option) {
        expires = 'expires' in option ? option.expires | 0 : expires;
        recheckInterval = 'cached' in option ? option.cached | 0 : recheckInterval;
        useGzip = 'gzip' in option ? !!option.gzip : useGzip;
        gzipMinLen = useGzip && 'gzip_min_len' in option ? option.gzip_min_len | 0 : gzipMinLen;
        hash_method = 'hash_method' in option ? option.hash_method : hash_method;
        cache_capacity = 'cache_capacity' in option ? option.cache_capacity | 0 : cache_capacity;
        cc = 'max-age=' + (expires / 1000 | 0);
    }

    const cache = LRUCache(cache_capacity);

    return function (req) {
        const headers = req.headers;
        let now = Date.now();

        let filename = req.filename = path.resolve(directory + req.pathname);
        let cached = cache.get(filename);
        let acceptsGzip = useGzip && GZIP.test(req.headers.get('accept-encoding'));
        let usesCache = headers.get('cache-control') !== 'no-cache';

        if (!usesCache || !cached || cached.recheck < now) { // cache is not fine

            // cache not matched or disabled
            let stats;
            try {
                stats = stat(filename);
            } catch (e) {
                cache.set(filename, {
                    recheck: now + recheckInterval,
                    ok: false
                });
                return NOT_FOUND;
            }

            // stat ok
            const lm = stats.mtime.toGMTString();

            cached = {
                recheck: now + recheckInterval,
                ok: true,
                lm: lm
            };
            cache.set(filename, cached);
            Object.defineProperty(cached, 'etag', {
                configurable: true,
                get: function () {
                    const content = read(filename), etag = hash_method(content, stats);
                    Object.defineProperty(this, 'etag', {value: etag});

                    const headers = {
                        Expires: new Date(now + expires).toGMTString(),
                        'ETag': etag,
                        'Cache-Control': cc,
                        'Content-Type': mimeTypes[path.extname(filename).substr(1)] || 'application/octet-stream'
                    }, options = {headers};

                    this.response = new Response(content, options);
                    if (useGzip) {
                        if (content.length >= gzipMinLen) {
                            options.headers['Content-Encoding'] = 'gzip';
                            this.gzipped_response = new Response(zlib.gzip(content), options);
                        } else {
                            this.gzipped_response = this.response;
                        }
                    }
                    return etag;
                }
            });
        }
        if (!cached.ok) return NOT_FOUND;

        // cache is ok
        if (headers.get('if-modified-since') === cached.lm || headers.get('if-none-match') === cached.etag) { // not changed, file won't be read
            return NOT_MODIFIED
        }

        return acceptsGzip ? cached.gzipped_response : cached.response;
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

function hash(content, stats) {
    return (+stats.mtime).toString(36) + '-' + stats.size.toString(36);
}