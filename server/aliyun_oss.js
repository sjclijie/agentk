import * as http from '../src/module/http.js';
import * as crypto from '../src/module/crypto.js';
import * as file from '../src/module/file.js';

const mimeTypes = {
    'htm': 'text/html', 'html': 'text/html',
    'js': 'text/javascript',
    'css': 'text/css',
    'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'json': 'application/json',
    'xml': 'application/xml'
};

const util = require('util');

export function request(conf, method, object, body, headers) {
    let date = new Date().toGMTString(),
        signedHeaders = '', mimeType = '', md5 = '';

    let newHeaders = {
        Date: date
    };

    if (headers) {
        for (let header of Object.keys(headers).sort()) {
            let val = newHeaders[header] = headers[header];
            if (header.substr(0, 6) === 'x-oss-') {
                signedHeaders += header + ':' + val + '\n';
            } else if (header.toLowerCase() === 'content-type') {
                mimeType = val;
            } else if (header.toLowerCase() === 'content-md5') {
                md5 = val;
            }
        }
    }

    if (conf.key) {
        let signedStr = `${method}\n${md5}\n${mimeType}\n${date}\n${signedHeaders}/${conf.bucket}${object}`;
        newHeaders.Authorization = "OSS " + conf.key.ak + ":" + crypto.hmac_sha1(conf.key.secret, signedStr, 'base64');
    }
    return http.request({
        method: method,
        host: conf.host,
        path: object,
        headers: newHeaders
    }, body);
}

export function put(conf, buf, object, headers) {
    if (!headers) headers = {};
    headers['Content-Type'] = mimeTypes[object.substr(object.lastIndexOf('.') + 1)] || 'application/octet-stream';
    headers['Content-Length'] = buf.length;

    return request(conf, 'PUT', object, buf, headers);
}

export function copy(conf, src, dest) {
    return request(conf, 'PUT', dest, undefined, {
        'Content-Length': 0,
        'x-oss-copy-source': '/' + conf.bucket + src
    });
}
export function get(conf, object, headers) {
    return request(conf, 'GET', object, undefined, headers);
}
