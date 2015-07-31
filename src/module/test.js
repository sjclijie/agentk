import * as http from 'http.js';

let passed = 0, total = 0, ms = 0;

const assert = require('assert'),
    ourl = require('url');
/**
 * Run a test script
 * @param {string} file pathname of a test script file
 */
export function run(file) {
    console.log('run', file);
    let start = process.hrtime();
    try {
        void include(file)[moduleDefault];
    } catch (e) {
        console.error('failed running script %s: %s', file, e.message);
        passed--;
        console.log(e.stack);
    }
    let end = process.hrtime(start);
    ms += end[0] * 1000 + end[1] / 1e6;
}

/**
 * Integration test on a router handle that accepts a http request and returns a http response
 *
 * @param {string} name
 * @param {function|router::Router} handle
 */
export function it(name, handle) {
    return new IntegrationTest(name, handle);
}

function IntegrationTest(name, handle) {
    this.name = name;
    this.handle = handle;
    this.title = 'init';
    this.succ = true;
    total++;
    passed++;
}

IntegrationTest.prototype.get = function (url, options) {
    options || (options = {});
    options.url = url;
    return this.request(options);
};

IntegrationTest.prototype.postForm = function (url, params, options) {
    options || (options = {});
    options.url = url;
    options.method = 'POST';
    let headers = options.headers || (options.headers = {});
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    options.body = new Buffer(http.buildQuery(params));
    return this.request(options);
};

IntegrationTest.prototype.read = function (response) {
    return co.promise(function (resolve) {
        let buffers = [];
        response.handle(response._request, {
            setHeader: function (name, val) {
                response.headers[name] = val;
                return this;
            },
            write: function (buf) {
                if (typeof buf === 'string') {
                    buffers.push(new Buffer(buf));
                } else if (Buffer.isBuffer(buf)) {
                    buffers.push(buf);
                } else {
                    throw new Error("write() accepts a string or Buffer");
                }
            }, end: function (buf) {
                if (arguments.length) {
                    this.write(buf);
                }
                resolve(Buffer.concat(buffers));
                this.end = function () {
                    throw new Error("end() called after data sent");
                }
            }
        })
    })
};

const http_defaults = {
    method: 'GET',
    url: '/',
    headers: {
        'host': 'localhost'
    }
};

Object.defineProperties(http_defaults, {
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
});

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


IntegrationTest.prototype.request = function (options) {
    options.__proto__ = http_defaults;
    let response = this.handle.apply(options, [options]);
    if (response && typeof response === 'object') {
        response._request = options;
    }
    return response;
};

IntegrationTest.prototype.test = function (name) {
    this.title = name;
    this.succ = true;
    total++;
    passed++;
};

IntegrationTest.prototype.assertEqual = function (actual, expected, message) {
    console.log('assertEqual', actual, expected);
    try {
        assert.strictEqual(actual, expected, `failed: ${message} (${this.name}: ${this.title})`);
    } catch (e) {
        console.error(e.message);
        if (this.succ) {
            this.succ = false;
            passed--;
        }
    }
};

export function summary() {
    console.log('\x1b[32m%d/%d tests passed (%dms)\x1b[0m', passed, total, ms);
}