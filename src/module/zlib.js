const ozlib = require('zlib');

/**
 * convert a buffer into a gzipped buffer
 *
 * @param {Buffer} buffer
 * @returns {Buffer}
 */
export function gzip(buffer) {
    return co.sync(ozlib.gzip, buffer);
}


/**
 * transforms a stream into a gzipped stream
 *
 * @param {net.Stream} stream
 * @returns {net.Stream}
 */
export function gzipTransform(stream) {
    return stream.pipe(ozlib.createGzip());
}

/**
 * transforms a gzipped stream into an unzipped stream
 *
 * @param {net.Stream} stream
 * @returns {net.Stream}
 */
export function gunzipTransform(stream) {
    return stream.pipe(ozlib.createGunzip());
}