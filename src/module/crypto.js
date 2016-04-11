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

/**
 *
 * @param {string} method see `require('crypto').getCiphers()`
 * @param {string|buffer} secret secret key
 * @param {string|Buffer} input plain text
 * @param {boolean} [padding] whether auto padding is used, defaults to false
 * @returns {Buffer}
 */
export function cipher(method, secret, input, padding) {
    return _cipher(new ocrypto.Cipher(method, secret), input, padding);
}

/**
 *
 * @param {string} method see `require('crypto').getCiphers()`
 * @param {string} key secret key
 * @param {string} iv initial vector
 * @param {string|Buffer} input plain text
 * @param {boolean} [padding] whether auto padding is used, defaults to false
 * @returns {Buffer}
 */
export function cipheriv(method, key, iv, input, padding) {
    return _cipher(new ocrypto.Cipheriv(method, key, iv), input, padding);
}
/**
 *
 * @param {string} method see `require('crypto').getCiphers()`
 * @param {string|buffer} secret secret key
 * @param {string|Buffer} input cipher text
 * @param {boolean} [padding] whether auto padding is used, defaults to false
 * @returns {Buffer}
 */
export function decipher(method, secret, input, padding) {
    return _cipher(new ocrypto.Decipher(method, secret), input, padding);
}
/**
 *
 * @param {string} method see `require('crypto').getCiphers()`
 * @param {string} key secret key
 * @param {string} iv initial vector
 * @param {string|Buffer} input cipher text
 * @param {boolean} [padding] whether auto padding is used, defaults to false
 * @returns {Buffer}
 */
export function decipheriv(method, key, iv, input, padding) {
    return _cipher(new ocrypto.Decipheriv(method, key, iv), input, padding);
}
function _cipher(cipher, input, padding) {
    cipher.setAutoPadding(!!padding);
    let buf1 = cipher.update(input);
    let buf2 = cipher.final();
    return buf1.length ?
        buf2.length ? Buffer.concat([buf1, buf2]) : buf1
        : buf2;
}

const crc_table = new Uint32Array(256);

for (var i = 0; i < 256; i++) {
    var c = i;
    for (var j = 0; j < 8; j++) {
        var cr = c & 1;
        c = c >> 1 & 0x7FFFFFFF;
        if (cr) {
            c ^= 0xedb88320;
        }
    }
    crc_table[i] = c;
}


function hash_crc32(buf, initial) {
    for (let i = 0, end = buf.length; i < end; i++) {
        initial = crc_table[initial & 0xFF ^ buf[i]] ^ (initial >> 8 & 0xFFFFFF);
    }
    return initial;
}

export function crc32(input, encoding) {
    if (typeof input === 'string')
        input = new Buffer(input, encoding || 'utf8');
    return hash_crc32(input, -1)
}