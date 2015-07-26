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
 * @param {node.stream::stream.Readable} stream
 * @returns {node.stream::stream.Readable}
 */
export function gzipTransform(stream) {
    return stream.pipe(ozlib.createGzip());
}

/**
 * transforms a gzipped stream into an unzipped stream
 *
 * @param {node.stream::stream.Readable} stream
 * @returns {node.stream::stream.Readable}
 */
export function gunzipTransform(stream) {
    return stream.pipe(ozlib.createGunzip());
}