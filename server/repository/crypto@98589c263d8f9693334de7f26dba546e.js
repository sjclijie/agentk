const ocrypto = require('crypto');

function hash(method, input, format) {
    return ocrypto.createHash(method).update(input).digest(format)
}

export function md5(buf, format) {
    return hash('md5', buf, format);
}