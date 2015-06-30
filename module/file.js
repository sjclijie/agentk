"use strict";

const ofs = require('fs');

export function read(path) {
    return co.async(ofs.readFile, [path]);
}