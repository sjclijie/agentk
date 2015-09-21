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


export class Test {
    /**
     * Unit test
     *
     * @param {name} name
     * @returns {Test}
     */
    constructor(name) {
        this.name = name;
    }

    test(title, cb) {
        passed++;
        total++;
        try {
            cb.call(this)
        } catch (e) {
            console.error(`${this.name}::${title} failed: ${e.stack || e.message || e}`);
            passed--;
        }
    }
}


export class IntegrationTest extends Test {
    /**
     * Integration test on a router handle that accepts a http request and returns a http response
     *
     * @param {string} name
     * @param {function|router::Router} handle
     * @returns {IntegrationTest}
     */
    constructor(name, handle) {
        super(name);
        this.handle = handle;
    }

    get(url, options) {
        options || (options = {});
        return this.request(url, options);
    }

    postForm(url, params, options) {
        options || (options = {});
        options.method = 'POST';
        let headers = options.headers || (options.headers = {});
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        options.body = new Buffer(http.buildQuery(params));
        return this.request(url, options);
    }

    request(url, options) {
        let parsed_url = ourl.parse(url, true);
        let req = new http.Request(url, options);
        req.originalUrl = options.url = parsed_url.path;
        req.request = options;
        req.pathname = parsed_url.pathname;
        req.query = parsed_url.query;
        req.search = parsed_url.search;

        return this.handle.apply(req, [req]);
    }
}

export function summary() {
    console.log('\x1b[32m%d/%d tests passed (%sms)\x1b[0m', passed, total, ms.toFixed(2));
}