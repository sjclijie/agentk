/**
 * Wrapper for http server/client API.
 *
 * @author kyrios
 */

import * as zlib from 'zlib';
import {read as stream_read} from 'stream'

const ohttp = require('http'),
    ourl = require('url'),
    ofs = require('fs'),
    oquerystring = require('querystring');

function* headersIterator(headers, cb) {
    let entries = headers._entries;
    for (let key in entries) {
        for (let arr = entries[key], i = 1, L = arr.length; i < L; i++) {
            yield cb(arr[i], key);
        }
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
        this._entries = Object.create(null);

        if (headers && typeof headers === 'object') {
            for (let name in headers) {
                this.append(name, headers[name]);
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
        name = '' + name;
        value = '' + value;
        let key = name.toLowerCase();
        if (key in this._entries) {
            this._entries[key].push(value);
        } else {
            this._entries[key] = [name, value];
        }
    }

    /**
     * Sets a header to the object.
     *
     * @param {string} name
     * @param {string} value
     */
    set(name, value) {
        name = '' + name;
        this._entries[name.toLowerCase()] = [name, '' + value];
    }

    /**
     * Deletes all headers named `name`
     *
     * @param {string} name
     */
    ["delete"] (name) {
        let key = ('' + name).toLowerCase();
        if (key in this._entries) {
            delete this._entries[key]
        }
    }


    /**
     * cb will be called with 3 arguments: value, name, and this Headers object
     *
     * @param {function} cb
     */
    forEach(cb) {
        let entries = this._entries;
        for (let key in entries) {
            let arr = entries[key];
            for (let i = 1, L = arr.length; i < L; i++) {
                cb(arr[i], key, this);
            }
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
        let key = ('' + name).toLowerCase();
        return key in this._entries ? this._entries[key][1] : null;
    }

    /**
     * Returns All values of this object with the name
     *
     * @param {string} name
     * @returns {Array}
     */
    getAll(name) {
        let key = ('' + name).toLowerCase();
        return key in this._entries ? this._entries[key].slice(1) : [];
    }

    /**
     * Returns whether an entry of the name exists
     *
     * @param {string} name
     * @returns {boolean}
     */
    has(name) {
        let key = ('' + name).toLowerCase();
        return key in this._entries;
    }

    /**
     * Returns an iterator that yields name-value pair of all entries
     *
     * @returns {Iterator}
     */
    entries() {
        return headersIterator(this, function (val, key) {
            return [key, val]
        })
    }

    /**
     * Returns an iterator that yields names of all entries
     *
     * @returns {Iterator}
     */
    keys() {
        return headersIterator(this, function (val, key) {
            return key
        })
    }

    /**
     * Returns an iterator that yields values of all entries
     *
     * @returns {Iterator}
     */
    values() {
        return headersIterator(this, function (val, key) {
            return val
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

const stream_Readable = require('stream').Readable;

export class Body {
    /**
     * Abstract class for http request/response entity
     *
     * @param {string|Buffer|ArrayBuffer|node.stream::stream.Readable} body
     */
    constructor(body) {
        let buf = null, stream = null;
        if (body && body instanceof stream_Readable) {
            stream = body;
        } else {
            if (!body) {
                buf = new Buffer(0)
            } else if (typeof body === 'string') {
                buf = new Buffer(body)
            } else if (body instanceof Buffer) {
                buf = body;
            } else if (body instanceof ArrayBuffer) {
                buf = new Buffer(new Uint8Array(body))
            } else {
                throw new Error('body accepts only string, Buffer, ArrayBuffer or stream.Readable');
            }
        }
        this._stream = stream;
        this._buffer = buf;
        this._payload = buf && Promise.resolve(buf);

    }

    /**
     *
     * @returns {Promise} a promise that yields the request payload as a string
     */
    text() {
        return this.buffer().then(buf => buf.toString())
    }

    /**
     *
     * @returns {Promise} a promise that yields the request payload as a JSON object
     */
    json() {
        return this.buffer().then(buf => JSON.parse(buf.toString()))
    }

    /**
     *
     * @returns {ArrayBuffer} a promise that yields the request payload as an ArrayBuffer
     */
    arrayBuffer() {
        return this.buffer().then(buf => new Uint8Array(buf).buffer)
    }

    /**
     *
     * @returns {Promise} a promise that yields the request payload as a Buffer
     */
    buffer() {
        let ret = this._payload;
        if (!ret) { // start stream reading
            let body = this, stream = this._stream;
            this._stream = null;
            ret = this._payload = new Promise(function (resolve, reject) {
                let bufs = [];
                stream.on('data', function (buf) {
                    bufs.push(buf)
                }).once('end', function () {
                    resolve(body._buffer = Buffer.concat(bufs))
                }).once('error', reject)
            });
        }
        return ret
    }

    /**
     *
     * @returns {node.stream::stream.Readable} a readable stream
     */
    get stream() {
        let body = this._stream;

        if (body) { // start stream reading
            this.buffer()
        } else {
            body = new stream_Readable();
            body._read = function () {
                body._read = Boolean;
            };
            this._payload.then(function (buf) {
                body.push(buf);
                body.push(null);
            })
        }

        return body;
    }
}

export class Request extends Body {
    /**
     * A `Request` is an representation of a client request that will be sent to a remote server, or a server request
     * that received from the remote client.
     *
     * @example
     *     // a normal request
     *     new http.Request('http://www.example.com/test?foo=bar')
     *     // a post request
     *     new http.Request('...', {
     *       method: 'POST',
     *       body: http.buildQuery({foo: 'bar'}),
     *       headers: {'content-type': 'application/x-www-form-urlencoded'}
     *     })
     *     // request to a unix domain socket
     *     new http.Request('unix:///foo/bar?test=foobar')
     *     // the server path is '/foo/bar' and the request url is '/?test=foobar'
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

        this._url = url;
        this._method = options && 'method' in options ? '' + options['method'] : 'GET';
        this._headers = options && 'headers' in options && typeof options.headers === 'object' ?
            options.headers instanceof Headers ? options.headers : new Headers(options.headers) : new Headers();
    }

    /**
     *
     * @returns {string} request method, e.g., `"GET"` `"POST"`
     */
    get method() {
        return this._method
    }

    /**
     *
     * @returns {string} request uri, like `"http://www.example.com/test?foo=bar"`
     */
    get url() {
        return this._url
    }

    /**
     *
     * @returns {Headers} request headers
     */
    get headers() {
        return this._headers
    }
}

export class Response extends Body {
    /**
     * A `Response` is an representation of a server response that will be sent to a remote client, or a client response
     * that received from the remote server.
     *
     * Additional fields can be used to manuplate the response object, which are:
     *
     *   - response.status `number`: status code of the response
     *   - response.statusText `number`: status text of the response
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
        this._headers = options && 'headers' in options && typeof options.headers === 'object' ?
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
        return this._headers
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

        this.headers.append('Set-Cookie', val);
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

function groupHeaders(obj) {
    const headers = Object.create(null),
        entries = obj._headers._entries;
    for (let key in entries) {
        let arr = entries[key];
        headers[arr[0]] = arr.length === 2 ? arr[1] : arr.slice(1);
    }
    return headers;
}

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
    let co_run = co.run;
    return co.promise(function (resolve, reject) {
        ohttp.createServer(handler).listen(port, host, backlog, function () {
            resolve(this)
        }).on('error', reject);
    });

    function handler(request, response) {
        request.body = request;
        let req = new Request('http://' + request.headers.host + request.url, request);

        req.request = request;
        req.response = response;

        // init req object
        req.originalUrl = request.url;
        Object.defineProperties(req, reqGetters);

        co_run(resolver, req).then(function (resp) { // succ
            if (!resp) return res.end();
            if (!(resp instanceof Response)) {
                throw new Error('illegal response object');
            }

            response.writeHead(resp.status, resp.statusText, groupHeaders(resp));

            let tmp;
            if (tmp = resp._buffer) {
                response.end(tmp);
            } else if (tmp = resp._stream) {
                tmp.pipe(response);
            } else {
                resp._payload.then(function (buffer) {
                    response.end(buffer);
                })
            }
        }).then(null, function (err) { // on error
            response.writeHead(500);
            response.end(err.message);
            console.error(err.stack);
        })
    }

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
 * Compose a http request.
 * `fetch` has two prototypes:
 *
 *   - function fetch(request:[Request](#class-Request))
 *   - function fetch(url:string, options:object)
 *
 * Please refer to the [Request](#class-Request) constructor for the info of the arguments
 * @param {string} url
 * @param {object} options
 * @retruns {Promise} a promise that yields a response on success
 */
export function fetch(url, options) {
    const req = typeof url === 'object' && url instanceof Request ? url : new Request(url, options);
    let parsedUrl = ourl.parse(req._url), headers = {};
    if (parsedUrl.protocol === 'unix:') {
        headers.host = 'localhost';
        options = {
            socketPath: parsedUrl.pathname,
            path: '/' + (parsedUrl.search || ''),
        }
    } else {
        headers.host = parsedUrl.host;
        options = {
            host: parsedUrl.hostname,
            port: parsedUrl.port || 80,
            path: parsedUrl.path
        }
    }
    options.method = req._method;
    options.headers = groupHeaders(req);

    return new Promise(function (resolve, reject) {
        req.stream.pipe(ohttp.request(options, function (tres) {
            resolve(new Response(tres, {
                status: tres.statusCode,
                statusText: tres.statusMessage,
                headers: tres.headers
            }))
        }).on('error', reject))
    })
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
    let url = ourl.parse(req.originalUrl, true);
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