const ocrypto = require('crypto');

function hash(method, input, format) {
    return ocrypto.createHash(method).update(input).digest(format)
}

function hash_hmac(method, secret, input, format) {
    return ocrypto.createHmac(method, secret).update(input).digest(format)
}

export function md5(buf, format) {
    return hash('md5', buf, format);
}

export function sha1(buf, format) {
    return hash('sha1', buf, format);
}

export function hmac_sha1(secret, buf, format) {
    return hash_hmac('sha1', secret, buf, format);
}