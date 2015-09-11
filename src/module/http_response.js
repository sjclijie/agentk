/**
 * This module contains a class named `HttpResponse` representing a response to a http request.
 *
 * @title Wrapper class for http response, and basic methods to construct a response.
 *
 */
import {gzip, gzipTransform} from 'zlib.js';

const ofs = require('fs');


/**
 * minimum body length to enable gzip. Responses that have payload less that that size will not be gzipped.
 *
 * @type {number}
 */
export let gzip_min_body_len = 1024;


export class HttpResponse {
    /**
     *
     * @returns {HttpResponse}
     * @constructor
     */
    constructor() {
        this.status = 200;
        this.headers = {};
        this.gzip = false;
    }


    setStatus(status) {
        this.status = status;
        return this;
    }

    setHeaders(headers) {
        for (let key of Object.keys(headers)) {
            this.headers[key] = headers[key];
        }
        return this;
    }

    setHeader(key, val) {
        this.headers[key] = val;
        return this;
    }

    setCookie(name, value, options) {
        let val = name + '=' + encodeURIComponent(value);
        if (options) {
            for (let key in options) {
                val += '; ' + key + '=' + options[key]
            }
        }

        let headers = this.headers;
        if (!('Set-Cookie' in headers)) {
            headers['Set-Cookie'] = val;
        } else if (typeof headers['Set-Cookie'] === 'string') {
            headers['Set-Cookie'] = [headers['Set-Cookie'], val];
        } else {
            headers['Set-Cookie'].push(val);
        }
        return this;
    }

    enableGzip() {
        this.gzip = true;
        return this;
    }

    handle(req, res) {
        res.end();
    }

}


function testGzip(resp, req, res) {
    if (resp.gzip && /\bgzip\b/.test(req.headers['accept-encoding'])) {
        res.setHeader('Content-Encoding', 'gzip');
        return true;
    }
    return false;
}

/**
 * create a HttpResponse that works with a handler
 *
 * @param {function} fun
 * @returns {HttpResponse}
 */
export function handler(fun) {
    let ret = new HttpResponse();
    ret.handle = fun;
    return ret;
}

/**
 * create a HttpResponse that sends some data to the client
 *
 * @param {string|Buffer} buffer
 * @returns {HttpResponse}
 */
export function data(buffer) {
    if (typeof buffer === 'string') buffer = new Buffer(buffer);
    return handler(function (req, res) {
        if (buffer.length > gzip_min_body_len && testGzip(this, req, res)) {
            buffer = gzip(buffer);
        }
        res.setHeader('Content-Length', '' + buffer.length);
        res.end(buffer)
    })
}

/**
 * create a HttpResponse that responds a error
 * @param {number} code The status code of the error response
 * @param {Error|string} reason The extra message as the response payload
 * @returns {HttpResponse}
 */
export function error(code, reason) {
    let ret;
    if (reason) {
        ret = data(reason.message || '' + reason)
    } else {
        ret = new HttpResponse().setStatus(code)
    }
    return ret.setStatus(code)
}

/**
 * create a HttpResponse that responds a json, The following header will be set:
 *
 *    Content-Type: application/json
 *
 * @param {*} json Data to be sent
 * @returns {HttpResponse}
 */
export function json(json) {
    return data(JSON.stringify(json)).setHeader('Content-Type', 'application/json');
}


/**
 * create a HttpResponse that responds a json, The following header will be set:
 *
 *
 * @param {*} json Data to be sent
 * @returns {HttpResponse}
 */
export function stream(stream) {
    return handler(function (req, res) {
        if (testGzip(this, req, res)) {
            stream = gzipTransform(stream)
        }
        stream.pipe(res)
    })
}

/**
 * create a HttpResponse that responds a local file. The local file should be present and readable,
 * otherwise empty response will be sent and no error is reported.
 *
 * @param file local file path
 * @returns {HttpResponse}
 */
export function file(file) {
    return stream(ofs.createReadStream(file).on('error', function (err) {
        console.error('unexpected file error', err);
        this.push(null)
    }));
}

/**
 * create a empty response with status code 200.
 *
 * @returns {HttpResponse}
 */
export function ok() {
    return new HttpResponse();
}

/**
 * create a redirect response
 * @param url redirection url
 */
export function redirect(url) {
    return new HttpResponse().setStatus(302).setHeader('Location', url)
}