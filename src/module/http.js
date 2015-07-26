/**
 * Wrapper for http server/client API.
 *
 * @author kyrios
 */

import * as zlib from 'zlib.js';
import {read as stream_read} from 'stream.js'

const ohttp = require('http'),
    ourl = require('url');

/**
 * maximum socket per host when calling request
 *
 * @type {number}
 */
export let maxSockets = 5;


const reqGetters = {
    pathname: {
        configurable: true,
        get: function () {
            parseUrl(this);
            return this.pathname;
        }
    }, search: {
        configurable: true,
        get: function () {
            parseUrl(this);
            return this.search;
        }
    }, query: {
        configurable: true,
        get: function () {
            parseUrl(this);
            return this.query;
        }
    }, body: {
        configurable: true,
        get: function () {
            let body = read(this);
            Object.defineProperty(this, 'body', {value: body});
            return body;
        }
    }
};

/**
 * Create a new http server, bind it to a port or socket file. A callback is supplied which accepts a
 * `[http request](https://nodejs.org/api/http.html#http_http_incomingmessage)` object as
 * parameter and returns a `[HttpResponse](http_response.html#HttpResponse)`
 *
 * @example
 *   http.listen(8080, function(req) {
 *     return http_response.ok()
 *   });
 *
 * @param {number|string} port TCP port number or unix domain socket path to listen to
 * @param {function|router::Router} cb request handler callback
 * @returns {node.http::http_Server}
 */
export function listen(port, cb) {
    return co.promise(function (resolve, reject) {
        let server = ohttp.createServer(function (req, res) {
            // init req object
            req.originalUrl = req.url;
            Object.defineProperties(req, reqGetters);

            co.run(resolver, req).then(function (resp) { // succ
                if (!resp) return res.end();

                res.statusCode = resp.status;
                for (let key of Object.keys(resp.headers)) {
                    res.setHeader(key, resp.headers[key])
                }

                resp.handle(req, res)
            }).then(null, function (err) { // on error
                res.writeHead(500);
                res.end(err.message);
                console.error(err.stack);
            })
        }).listen(port, function () {
            resolve(server)
        }).on('error', reject);
    });

    function resolver(req) {
        return cb.apply(req, [req]);
    }
}

export function request(options, body) {
    return co.promise(function (resolve, reject) {
        ohttp.request(options, resolve).on('error', reject).end(body);
    });
}

export function read(incoming) {
    if (incoming.headers['content-encoding'] === 'gzip') { // gzipped
        incoming = zlib.gunzipTransform(incoming);
    }
    return stream_read(incoming)
}


function parseUrl(req) {
    let url = ourl.parse(req.url, true);
    Object.defineProperties(req, {
        pathname: {
            writable: true,
            value: url.pathname
        },
        search: {
            writable: true,
            value: url.search
        },
        query: {
            writable: true,
            value: url.query
        }
    })
}