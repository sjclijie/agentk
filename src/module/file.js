"use strict";

const ofs = require('fs'),
    path = require('path');

/**
 * reads file's content, returns a buffer containing its content. throws if any exception occurs
 *
 * @param {String} file
 * @returns {Buffer}
 */
export function read(file) {
    return co.async(ofs.readFile, file);
}

export function write(file, content) {
    return co.async(ofs.writeFile, file, content);
}

export function rm(file) {
    ofs.unlinkSync(file);
}

export function symlink(src, dst) {
    ofs.symlinkSync(src, dst);
}

export function exists(file) {
    return ofs.existsSync(file)
}

export function mkdir(file) {
    ofs.mkdirSync(file);
}

export function mkParentDir(file) {
    let dir = path.dirname(file);
    if (ofs.existsSync(dir)) return;
    mkParentDir(dir);
    ofs.mkdirSync(dir);
}