import * as http from 'http.js';
import * as crypto from 'crypto.js';
import * as file from 'file.js';

export default function (config) {
    if (config.keyfile) {
        config.key = JSON.parse(file.read(config.keyfile));
    }
    return new Oss(config);
}


function Oss(conf) {
    this.conf = conf;
}

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

function request(oss, method, object, body, options) {
    let date = new Date().toGMTString(), headers, conf = oss.conf,
        signedHeaders = '', mimeType = '';

    if (options) {
        headers = {
            'Date': date,
            'Content-Type': options.type,
            'Content-Length': options.length
        };
        if (options.name) {
            headers['Content-Disposition'] = 'attachment; filename=' + options.name;
        }
        if (options.headers) {
            util._extend(headers, options.headers);

            signedHeaders = Object.keys(options.headers).filter(function (header) {
                return header.substr(0, 6) === 'x-oss-';
            }).sort().reduce(function (str, header) {
                return str + header + ':' + headers[header] + '\n';
            }, '');
        }
        mimeType = options.type;
    } else {
        headers = {
            'Date': date
        };
    }
    if (conf.key) {
        let signedStr = `${method}\n\n${mimeType}\n${date}\n${signedHeaders}/${conf.bucket}${object}`;
        headers.Authorization = "OSS " + conf.key.ak + ":" + crypto.hmac_sha1(conf.key.secret, signedStr, 'base64');
    }
    return http.request({
        method: method,
        host: conf.host,
        path: object,
        headers: headers
    }, body);
}

Oss.prototype.put = function (buf, object, options) {
    if (!options) options = {};
    options.type = mimeTypes[object.substr(object.lastIndexOf('.') + 1)] || 'application/octet-stream';
    options.length = buf.length;

    return request(this, 'PUT', object, buf, options);
};