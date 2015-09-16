import {Response} from 'http.js';
import * as file from 'file.js';

const opath = require('path');

/**
 * directory of view template files (default to current directory)
 *
 * @type {string}
 */
export let path = '';

/**
 * default view engine when no extension name is supplied
 * @type {string}
 */
export let view_engine = 'ejs';

/**
 * map of view engines, user can supply a specific view engine by assigning to this object
 *
 * @example
 *
 *     view.engines.jade = require('jade').__express;
 *
 * @type {object}
 */
export const engines = {};

/**
 * method used to load view engine by extension, default to `require`. User can supply a specific loader by assigning
 * this variable
 *
 * @example
 *
 *     view.module_loader = function(name) {
 *         return require(name).__express
 *     }
 *
 * @type {function}
 */
export let module_loader = function (name) {
    return require(name).__express
};

Object.defineProperty(engines, 'ejs', {
    configurable: true,
    get: function () {
        let ejs;
        try {
            ejs = module_loader('ejs');
        } catch (e) {
            ejs = require('ejs').__express;
        }
        Object.defineProperty(this, 'ejs', {
            value: ejs
        });
        return ejs;
    }
});

/**
 * render a template file into response content, returns a `HttpResponse`.
 * User should specify content type if needed.
 *
 * @param {string} name template name, with or without extension
 * @param {object} locals local bindings
 * @param {string} mimeType custom mimeType, default to 'text/html'
 * @returns {HttpResponse}
 */
export function render(name, locals, mimeType) {
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
            engine = engines[ext] = module_loader(ext);
        } catch (e) {
        }
    }
    if (typeof engine !== 'function') {
        throw new Error("engine for extension '" + ext + "' not found");
    }
    if (!file.exists(filename)) {
        throw new Error("template file not found: " + name);
    }
    return new Response(co.sync(engine, filename, locals), {
        headers: {
            'content-type': mimeType || 'text/html'
        }
    });
}

