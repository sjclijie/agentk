const ozlib = require('zlib');

export function gzip(buffer) {
    return co.async(ozlib.gzip, buffer);
}

export function gzipTransform(stream) {
    return stream.pipe(ozlib.createGzip());
}

/**
 *
 * @param stream
 */
export function gunzipTransform(stream) {
    return stream.pipe(ozlib.createGunzip());
}
