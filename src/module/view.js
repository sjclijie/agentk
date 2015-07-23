import * as response from 'http_response.js';
import * as file from 'file.js';

const opath = require('path');

export let path = '';
export let view_engine = 'ejs';
export const engines = {};
export let module_loader = require;

Object.defineProperty(engines, 'ejs', {
    configurable: true,
    get: function () {
        let ejs;
        try {
            ejs = module_loader('ejs').__express;
        } catch (e) {
            ejs = require('ejs').__express;
        }
        Object.defineProperty(this, 'ejs', {
            value: ejs
        });
        return ejs;
    }
});

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
            engine = engines[ext] = module_loader(ext).__express;
        } catch (e) {
        }
    }
    if (typeof engine !== 'function') {
        throw new Error("engine for extension '" + ext + "' not found");
    }
    if (!file.exists(filename)) {
        throw new Error("template file not found: " + name);
    }
    return response.data(co.sync(engine, filename, locals));
}

