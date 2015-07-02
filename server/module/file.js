"use strict";

const ofs = require('fs');

/**
 * reads file's content, returns a buffer containing its content. throws if any exception occurs
 *
 * @param {String} path
 * @returns {Buffer}
 */
export function read(path) {
    return co.async(ofs.readFile, [path]);
}

export function write(path, content) {
    return co.async(ofs.writeFile, [path, content]);
}

export function unlink(path) {
    return ofs.unlinkSync(path);
}

export function symlink(src, dst) {
    return ofs.symlinkSync(src, dst);
}