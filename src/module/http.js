/**
 * Wrapper for http server/client API.
 *
 * @author kyrios
 */

import * as zlib from 'zlib.js';
import {read as stream_read} from 'stream.js'

const ohttp = require('http'),
    ourl = require('url'),
    ofs = require('fs'),
    oquerystring = require('querystring');


const header_entries = Symbol('entries'), header_names = Symbol('names');

class Iterator {
    constructor(handle, transform) {
        const iterator = handle[Symbol.iterator]();
        this.next = function () {
            let obj = iterator.next();
            if (obj.done) return obj;
            obj.value = transform(obj.value);
            return obj;
        }
    }

    [Symbol.iterator]() {
        return this
    }
}


export class Headers {
    /**
     * Headers represents a set of name-value pairs which will be used in:
     *  - client request object
     *  - remote server response
     *  - server request event
     *
     * @param {object} [headers] initial name-value map of headers
     */
    constructor(headers) {
        let arr = this[header_entries] = []; // [[lower-cased name, value], ...]
        let names = this[header_names] = Object.create(null);

        if (headers && typeof headers === 'object') {
            for (let key in headers) {
                let name = key.toLowerCase();
                arr.push([name, '' + headers[key]]);
                names[name] = true;
            }
        }
    }

    /**
     * Appends an entry to the object.
     *
     * @param {string} name
     * @param {string} value
     */
    append(name, value) {
        name = ('' + name).toLowerCase();
        this[header_entries].push([name, '' + value]);
        this[header_names][name] = true;
    }

    /**
     * Sets a header to the object.
     *
     * @param {string} name
     * @param {string} value
     */
    set(name, value) {
        let names = this[header_names],
            entries = this[header_entries];
        if (name in names) {
            for (let L = entries.length; L--;) {
                if (entries[L][0] === name) {
                    entries.splice(L, 1);
                }
            }
        } else {
            names[name] = true;
        }
        entries.push([name, '' + value]);
    }

    /**
     * Deletes all headers named `name`
     *
     * @param {string} name
     */
    ["delete"] (name) {
        name = ('' + name).toLowerCase();
        let names = this[header_names];
        if (!(name in names)) return;
        for (let arr = this[header_entries], L = arr.length; L--;) {
            if (arr[L][0] === name) {
                arr.splice(L, 1);
            }
        }
        delete names[name]
    }


    /**
     * cb will be called with 3 arguments: value, name, and this Headers object
     *
     * @param {function} cb
     */
    forEach(cb) {
        for (let entry of this[header_entries]) {
            cb(entry[1], entry[0], this)
        }
    }

    /**
     * Returns the value of an entry of this object, or null if none exists.
     *
     * The first will be returned if multiple entries were found.
     *
     * @param {string} name
     * @returns {null|string}
     */
    get(name) {
        name = ('' + name).toLowerCase();
        if (!(name in this[header_names])) return null;
        for (let entry of this[header_entries]) {
            if (entry[0] === name) return entry[1];
        }
    }

    /**
     * Returns All values of this object with the name
     *
     * @param {string} name
     * @returns {Array}
     */
    getAll(name) {
        name = ('' + name).toLowerCase();
        let result = [];
        if (name in this[header_names]) {
            for (let entry of this[header_entries]) {
                if (entry[0] === name) result.push(entry[1]);
            }
        }
        return result
    }

    /**
     * Returns whether an entry of the name exists
     *
     * @param {string} name
     * @returns {boolean}
     */
    has(name) {
        name = ('' + name).toLowerCase();
        return name in this[header_names]
    }

    /**
     * Returns an iterator that yields name-value pair of all entries
     *
     * @returns {Iterator}
     */
    entries() {
        return new Iterator(this[header_entries], function (entry) {
            return [entry[0], entry[1]]
        })
    }

    /**
     * Returns an iterator that yields names of all entries
     *
     * @returns {Iterator}
     */
    keys() {
        return new Iterator(this[header_entries], function (entry) {
            return entry[0]
        })
    }

    /**
     * Returns an iterator that yields values of all entries
     *
     * @returns {Iterator}
     */
    values() {
        return new Iterator(this[header_entries], function (entry) {
            return entry[1]
        })
    }

    /**
     * Returns an iterator that yields name-value pair of all entries
     *
     * @returns {Iterator}
     */
    [Symbol.iterator]() {
        return this.entries()
    }
}

const stream_Readable = require('stream').Readable,
    body_payload = Symbol('payload'),
    body_stream = Symbol('stream');

export class Body {
    /**
     * Abstract class for http request/response entity
     *
     * @param {string|Buffer|ArrayBuffer|node.stream::stream.Readable} body
     */
    constructor(body) {
        if (body && body instanceof stream_Readable) {
            this[body_payload] = null;
            this[body_stream] = body;
        } else {
            if (!body) {
                body = new Buffer(0)
            } else if (typeof body === 'string') {
                body = new Buffer(body)
            } else if (body instanceof Buffer) {
            } else if (body instanceof ArrayBuffer) {
                body = new Buffer(new Uint8Array(body))
            } else {
                throw new Error('body accepts only string, Buffer, ArrayBuffer or stream.Readable');
            }
            this[body_payload] = Promise.resolve(body)
        }
    }

    /**
     *
     * @returns {Promise} a promise that yields the request payload as a string
     */
    text() {
        return this.buffer().then(function (buf) {
            return buf.toString()
        })
    }

    /**
     *
     * @returns {Promise} a promise that yields the request payload as a JSON object
     */
    json() {
        return this.buffer().then(function (buf) {
            return JSON.parse(buf.toString())
        })
    }

    /**
     *
     * @returns {ArrayBuffer} a promise that yields the request payload as an ArrayBuffer
     */
    arrayBuffer() {
        return this.buffer().then(function (buf) {
            return new Uint8Array(buf).buffer
        })
    }

    /**
     *
     * @returns {Promise} a promise that yields the request payload as a Buffer
     */
    buffer() {
        console.log('getting buffer');
        let ret = this[body_payload];
        if (!ret) { // start stream reading
            let body = this[body_stream];
            console.log('start reading stream');
            this[body_stream] = null;
            ret = this[body_payload] = new Promise(function (resolve, reject) {
                let bufs = [];
                body.on('data', function (buf) {
                    bufs.push(buf)
                }).once('end', function () {
                    resolve(Buffer.concat(bufs))
                }).once('error', reject)
            });
        }
        return ret
    }

    /**
     *
     * @returns {Promise} a promise that yields the request payload as a readable stream
     */
    stream() {
        let body = this[body_stream];

        if (body) { // start stream reading
            this.buffer()
        } else {
            body = new stream_Readable();
            body._read = function () {
            };
            this[body_payload].then(function (buf) {
                body.push(buf);
                body.push(null);
            })
        }

        return body;
    }
}

const request_method = Symbol('method'),
    request_url = Symbol('url'),
    request_headers = Symbol('headers');

export class Request extends Body {
    /**
     * A `Request` is an representation of a client request that will be sent to a remote server, or a server request
     * that received from the remote client.
     *
     * @extends Body
     * @param {string} url a remote url
     * @param {object} [options] optional arguments, which contains any of:
     *
     *   - method `String`: request method, e.g., "GET" or "POST"
     *   - headers `object|Headers` request headers
     *   - body `string|Buffer|ArrayBuffer|node.stream::stream.Readable` request payload to be sent or received
     *
     * @returns {Request}
     */
    constructor(url, options) {
        if (options && typeof options !== 'object') options = null;
        super(options && options.body);

        this[request_url] = url;


        this[request_method] = options && 'method' in options ? '' + options['method'] : 'GET';
        this[request_headers] = options && 'headers' in options && typeof options.headers === 'object' ?
            options.headers instanceof Headers ? options.headers : new Headers(options.headers) : new Headers();
    }

    /**
     *
     * @returns {string} request method, e.g., `"GET"` `"POST"`
     */
    get method() {
        return this[request_method]
    }

    /**
     *
     * @returns {string} request uri, like `"http://www.example.com/test?foo=bar"`
     */
    get url() {
        return this[request_url]
    }

    /**
     *
     * @returns {Headers} request headers
     */
    get headers() {
        return this[request_headers]
    }
}

export class Response extends Body {
    /**
     * A `Response` is an representation of a server response that will be sent to a remote client, or a client response
     * that received from the remote server.
     *
     * Additional fields can be used to manuplate the response object, which are:
     *
     *   - status `number`: status code of the response
     *   - statusText `number`: status text of the response
     *
     * @extends Body
     * @param {string|Buffer|ArrayBuffer|node.stream::stream.Readable} [body]
     * @param {object} [options] optional arguments,  which contains any of:
     *
     *   - status `number`: The status code for the reponse, e.g., 200.
     *   - statusText `string`: The status message associated with the staus code, e.g., OK.
     *   - headers `object|Headers`: the response headers
     */
    constructor(body, options) {
        super(body);

        if (options && typeof options !== 'object') options = null;

        let status = this.status = options && 'status' in options ? options.status | 0 : 200;
        this.statusText = options && 'statusText' in options ? '' + options.statusText : ohttp.STATUS_CODES[status] || '';
        this[request_headers] = options && 'headers' in options && typeof options.headers === 'object' ?
            options.headers instanceof Headers ? options.headers : new Headers(options.headers) : new Headers();
    }

    /**
     * @returns {boolean}
     */
    get ok() {
        return this.status >= 200 && this.status <= 299
    }

    /**
     *
     * @returns {Headers} response headers
     */
    get headers() {
        return this[request_headers]
    }


    /**
     * Adds Set-Cookie header to the response object
     *
     * @param {string} name cookie name to be set
     * @param {string} value cookie value to be set
     * @param {object} [options] optional keys to be appended, which can contain any of `expires`, `domain`, `path` etc.
     */
    setCookie(name, value, options) {
        let val = name + '=' + encodeURIComponent(value);
        if (options) {
            for (let key in options) {
                val += '; ' + key + '=' + options[key]
            }
        }

        this.headers.append('set-cookie', val);
    }

    /**
     * Creates an error response
     *
     * @param {number} status
     * @param {Error|string|Buffer} reason message of the error as the response body
     */
    static error(status, reason) {
        return new Response(reason && (reason.message || '' + reason), {
            status: status
        });
    }

    /**
     * Creates a json response, a `content-type` header will be added to the headers
     *
     * @param obj data to be sent
     * @returns {Response}
     */
    static json(obj) {
        console.log('json', obj);
        return new Response(JSON.stringify(obj), {
            headers: {'content-type': 'application/json'}
        })
    }

    /**
     * Creates a redirect response, the status will be set to 302, and a `location` header will be added
     *
     * @param {string} url redirect url, e.g. 'http://www.example.com' or '/foo/bar'
     * @returns {Response}
     */
    static redirect(url) {
        return new Response(null, {
            status: 302,
            headers: {'location': url}
        })
    }

    static file(file) {
        return new Response(ofs.createReadStream(file).on('error', function (err) {
            console.error('unexpected file error', err);
            this.push(null)
        }));
    }
}

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
    }
};


/**
 * Create a new http server, bind it to a port or socket file. A callback is supplied which accepts a
 * [`Request`](#class-Request) object as parameter and returns a [`Response`](#class-Response)
 *
 * There are some extra properties that can be accessed with the `req` object:
 *
 *   - req.request [`http.IncomingMessage`](https://nodejs.org/api/http.html#http_http_incomingmessage) original request object
 *   - req.response [`http.ServerResponse`](https://nodejs.org/api/http.html#http_class_http_serverresponse) original response object
 *   - req.originalUrl `string` request's original url, should not be overwritten
 *   - req.pathname `string` request's pathname, could be overwritten by `Router.prefix` method
 *   - req.search `string` search string, e.g. `?foo=bar`
 *   - req.query `object` key-value map of the query string
 *
 * @example
 *     http.listen(8080, function(req) {
 *         return new http.Response('<h1>Hello world</h1>', {
 *             status: 200,
 *             headers: {
 *                 'content-type': 'text/html'
 *             }
 *         })
 *     });
 *
 * @param {number|string} port TCP port number or unix domain socket path to listen to
 * @param {function|router::Router} cb request handler callback
 * @param {string} [host] hostname to listen to, only valid if port is a 0-65535 number
 * @param {number} [backlog] maximum requests pending to be accepted, only valid if port is a 0-65535 number
 * @returns {node.http::http.Server} returned after the `listening` event has been fired
 */
export function listen(port, cb, host, backlog) {
    return co.promise(function (resolve, reject) {
        ohttp.createServer(function (request, response) {
            request.body = request;
            let req = new Request('http://' + request.headers.host + request.url, request);

            req.request = request;
            req.response = response;

            // init req object
            req.originalUrl = req.url;
            Object.defineProperties(req, reqGetters);

            co.run(resolver, req).then(function (resp) { // succ
                if (!resp) return res.end();
                if (!(resp instanceof Response)) {
                    throw new Error('illegal response object');
                }

                response.statusCode = resp.status;

                for (let entry of resp.headers[header_entries]) {
                    response.setHeader(entry[0], entry[1])
                }

                if (resp[body_stream]) {
                    resp[body_stream].pipe(response);
                } else {
                    resp[body_payload].then(function (buffer) {
                        response.end(buffer);
                    })
                }
            }).then(null, function (err) { // on error
                response.writeHead(500);
                response.end(err.message);
                console.error(err.stack);
            })
        }).listen(port, host, backlog, function () {
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