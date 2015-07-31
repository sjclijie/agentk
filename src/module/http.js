/**
 * Wrapper for http server/client API.
 *
 * @author kyrios
 */

import * as zlib from 'zlib.js';
import {read as stream_read} from 'stream.js'

const ohttp = require('http'),
    ourl = require('url'),
    oquerystring = require('querystring');

/**
 * default agent for http request. You can set
 * maximum socket per host when calling request
 *
 * @type {node.http::http.Agent}
 */
export const agent = new ohttp.Agent();


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
            let body = stream_read(this);
            Object.defineProperty(this, 'body', {value: body});
            return body;
        }
    }
};

/**
 * Create a new http server, bind it to a port or socket file. A callback is supplied which accepts a
 * [`http.IncomingMessage`](https://nodejs.org/api/http.html#http_http_incomingmessage) object as
 * parameter and returns a [`HttpResponse`](http_response.html#HttpResponse)
 *
 * There are some extra properties that can be accessed with the `req` object:
 *
 *   - req.pathname `string` request's pathname, could be overwritten by `Router.prefix` method
 *   - req.search `string` search string, looks like `?foo=bar`
 *   - req.query `object` key-value map of the query string
 *   - req.body `Buffer` request payload
 *
 * @example
 *     http.listen(8080, function(req) {
 *         return http_response.ok()
 *     });
 *
 * @param {number|string} port TCP port number or unix domain socket path to listen to
 * @param {function|router::Router} cb request handler callback
 * @returns {node.http::http.Server}
 */
export function listen(port, cb) {
    return co.promise(function (resolve, reject) {
        ohttp.createServer(function (req, res) {
            // init req object
            req.originalUrl = req.url;
            Object.defineProperties(req, reqGetters);
            req.response = res;

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
            resolve(this)
        }).on('error', reject);
    });

    function resolver(req) {
        return cb.apply(req, [req]);
    }
}

/**
 * default User Agent for http request
 *
 * @type {string}
 */
export let client_ua = `AgentK/${process.versions.agentk} NodeJS/${process.version.substr(1)}`;

/**
 * Create a http request, the
 * @param {object} options See [request](https://nodejs.org/api/http.html#http_http_request_options_callback) on Node.JS documentation.
 *
 * Available options are:
 *
 *   - options.host `string` hostname to connect to
 *   - options.port `number` port number to connect to, default to `80`
 *   - options.socketPath `string` against host:port, use socketPath to create connection
 *   - options.method `string` request method, default to `"GET"`
 *   - options.path `string` request url pathname and query string, default to `"/"`
 *   - options.headers `object` request header names and values map
 *   - options.proxy `string|object` http proxy server, maybe string like: `"<user>:<password>@<host>:<port>"` or object with these keys
 *
 * @param {string|Buffer} body data to be sent to as payload, maybe null or undefined if there is no payload
 * @returns {node.http::http.ServerResponse} a response object that can be operated and read as a stream.
 */
export function request(options, body) {
    return co.promise(function (resolve, reject) {
        handleRequestOptions(options);
        if ('method' in options && options.method !== 'GET') { // requires body
            if (typeof body === 'string') {
                body = new Buffer(body);
            }
            options.headers['Content-Length'] = body ? '' + body.length : '0';
        } else {
            body = null;
        }
        ohttp.request(options, resolve).on('error', reject).end(body);
    });
}

/**
 * Similar to [request](#request), but requires a `stream.Readable` object rather than a string/buffer as the request payload.
 *
 * @param {object} options similar to [request](#request)
 * @param {node.stream::stream.Readable} stream a readable stream
 * @returns {node.http::http.ServerResponse}
 */

export function pipe(options, stream) {
    return co.promise(function (resolve, reject) {
        handleRequestOptions(options);

        stream.pipe(ohttp.request(options, resolve).on('error', reject));
    });
}

function handleRequestOptions(options) {
    const headers = options.headers || (options.headers = {});
    'User-Agent' in headers || (headers['User-Agent'] = client_ua);
    'agent' in options || (options.agent = agent);
    if (options.proxy) {
        let proxy = options.proxy, auth;
        if (typeof proxy === 'string') {
            proxy = ourl.parse('http://' + proxy);
            auth = proxy.auth;
        } else {
            if ('user' in proxy) {
                auth = proxy.user + ':' + proxy.password;
            }
        }
        options.path = `http://${options.host}:${options.port || '80'}${options.path || '/'}`;
        options.host = proxy.host;
        options.port = proxy.port;
        if (auth) {
            headers['Proxy-Authorization'] = 'Basic ' + new Buffer(auth).toString('base64');
        }
    }
}

/**
 * Read and return a `http.ServerResponse`'s body. Similar to `stream.read`, but it can handle gzipped response content.
 *
 * @param {node.http::http.ServerResponse} incoming a server response
 * @returns {Buffer} response body
 */
export function read(incoming) {
    if (incoming.headers['content-encoding'] === 'gzip') { // gzipped
        incoming = zlib.gunzipTransform(incoming);
    }
    return stream_read(incoming)
}

/**
 * Build a http query string from a key-value map
 *
 * @example
 *
 *     let body = {"foo": "bar"}
 *     let payload = http.buildQuery(forms); // "foo=bar"
 *     // compose a POST request
 *     let response = http.request({
 *         method: "POST",
 *         host: "...",
 *         path: "/api/data.php",
 *         headers: {
 *             'Content-Type': 'application/x-www-form-urlencoded'
 *         }
 *     }, payload);
 *
 * @param {object} obj keys and values
 * @returns {string} query string
 */
export function buildQuery(obj) {
    return oquerystring.stringify(obj);
}

/**
 * Parse a http query string into a key-value map.
 * May throw error if malformed UTF-8 escape sequence found
 *
 * @example
 *
 *     // read a request's body and parse its content
 *     let payload = req.body.toString(); // "foo=bar"
 *     let body = http.parseQuery(payload); // {"foo": "bar"}
 *
 * @param {string} query query string to be parsed
 * @returns {object} keys and values
 */
export function parseQuery(query) {
    return oquerystring.parse(query);
}


function parseUrl(req) {
    let url = ourl.parse(req.url, true);
    Object.defineProperties(req, {
        pathname: {
            writable: true,
            value: url.pathname
        },
        search: {
            value: url.search
        },
        query: {
            value: url.query
        }
    })
}