import * as http from 'http.js';

let passed = 0, total = 0, ms = 0;

const assert = require('assert'),
    ohttp = require('http'),
    ostream = require('stream'),
    ourl = require('url'),
    util = require('util');
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
 * Unit test
 *
 * @param {name} name
 * @returns {Test}
 */
export function Test(name) {
    this.name = name;
    this.title = '_init';
    this.succ = true;
    total++;
    passed++;
}

Test.prototype.test = function (name) {
    if (this.title !== '_init' || !this.succ) {
        total++;
        passed++;
    }
    this.title = name;
    this.succ = true;
};

Test.prototype.assertEqual = function (actual, expected, message) {
    if (!Object.is(actual, expected)) {
        this.fail(message);
        console.error('expected', expected, 'actual', actual);
    }
};

Test.prototype.fail = function (message) {
    console.error(`failed: ${message || 'assertion fail'} (${this.name}: ${this.title})`);
    if (this.succ) {
        this.succ = false;
        passed--;
    }
    if (this.succ) {
        this.succ = false;
        passed--;
    }
};

Test.prototype.assert = function (bool, message) {
    if (!bool)
        this.fail(message)
};

/**
 * Integration test on a router handle that accepts a http request and returns a http response
 *
 * @param {string} name
 * @param {function|router::Router} handle
 * @returns {IntegrationTest}
 */
export function IntegrationTest(name, handle) {
    Test.call(this, name);
    this.handle = handle;
}
util.inherits(IntegrationTest, Test);


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
    let resp = this.handle.apply(options, [options]);

    return co.promise(function (resolve) {
        let result = {};
        let socket = new ostream.Writable();
        let buffers = [];

        socket._write = function (chunk, encoding, callback) {
            buffers.push(chunk);
            callback();
        };

        let res = new ohttp.ServerResponse(options);
        res._storeHeader = function (firstLine, headers) {
            var m = /HTTP\/(1\.\d) (\d+) (.+)/.exec(firstLine);
            result.version = m[1];
            result.status = +m[2];
            result.reason = m[3];
            result.headers = headers;
            res._headerSent = true;
        };
        res.assignSocket(socket);

        res.once('finish', function () {
            result.body = Buffer.concat(buffers);
            resolve(result)
        });

        if (!resp) return res.end();

        res.statusCode = resp.status;
        for (let key of Object.keys(resp.headers)) {
            res.setHeader(key, resp.headers[key])
        }

        resp.handle(options, res);
    });
};


export function summary() {
    console.log('\x1b[32m%d/%d tests passed (%dms)\x1b[0m', passed, total, ms);
}