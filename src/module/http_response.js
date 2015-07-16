import {gzip, gzipTransform} from 'zlib.js';

const ofs = require('fs');

export let gzip_min_buf_len = 1024;

export function HttpResponse() {
    this.status = 200;
    this.headers = {};
    this.gzip = false;
}

HttpResponse.prototype.setStatus = function (status) {
    this.status = status;
    return this;
};

HttpResponse.prototype.setHeaders = function (headers) {
    for (let key of Object.keys(headers)) {
        this.headers[key] = headers[key];
    }
    return this;
};

HttpResponse.prototype.setHeader = function (key, val) {
    this.headers[key] = val;
    return this;
};

HttpResponse.prototype.setCookie = function (name, value, options) {
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
};

HttpResponse.prototype.enableGzip = function () {
    this.gzip = true;
    return this;
};

HttpResponse.prototype.handle = function (req, res) {
    res.end();
};

function testGzip(resp, req, res) {
    if (resp.gzip && /\bgzip\b/.test(req.headers['accept-encoding'])) {
        res.setHeader('Content-Encoding', 'gzip');
        return true;
    }
    return false;
}

export function handler(fun) {
    let ret = new HttpResponse();
    ret.handle = fun;
    return ret;
}

export function data(buffer) {
    if (typeof buffer === 'string') buffer = new Buffer(buffer);
    return handler(function (req, res) {
        if (buffer.length > gzip_min_buf_len && testGzip(this, req, res)) {
            buffer = gzip(buffer);
        }
        res.setHeader('Content-Length', '' + buffer.length);
        res.end(buffer)
    })
}

export function error(code, reason) {
    let ret;
    if (reason) {
        ret = data(reason.message || '' + reason)
    } else {
        ret = new HttpResponse().setStatus(code)
    }
    return ret.setStatus(code)
}

export function json(json) {
    return data(JSON.stringify(json)).setHeader('Content-Type', 'application/json');
}

export function stream(stream) {
    return handler(function (req, res) {
        if (testGzip(this, req, res)) {
            stream = gzipTransform(stream)
        }
        stream.pipe(res)
    })
}

export function file(file) {
    return stream(ofs.createReadStream(file).on('error', function (err) {
        console.error('unexpected file error', err);
        this.push(null)
    }));
}

export function ok() {
    return new HttpResponse();
}

export function redirect(url) {
    return new HttpResponse().setStatus(302).setHeader('Location', url)
}
