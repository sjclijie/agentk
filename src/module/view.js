import * as response from 'http_response.js';
import * as file from 'file.js';

const opath = require('path');

export let path = '';
export let view_engine = 'ejs';
export let engines = {};

export function render(name, locals) {
    let ext = opath.extname(name),
        filename = opath.join(path, name);
    if (!ext) {
        ext = view_engine;
        if (!file.exists(filename)) {
            filename += '.' + ext;
        }
    } else {
        ext = ext.substr(1);
    }
    let engine = engines[ext];
    if (!engine) {
        try {
            engine = engines[ext] = require(ext).__express;
        } catch (e) {
        }
    }
    if (typeof engine !== 'function') {
        throw new Error("engine for extension '" + ext + "' not found");
    }
    if (!file.exists(filename)) {
        throw new Error("template file not found: " + name);
    }
    return response.data(co.async(engine, filename, locals));
}

