import {Response} from 'http';
import * as file from 'file';

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

/**
 * Default mime type
 *
 * @type {string}
 */
export let defaultMimeType = 'text/html';

/**
 * render a template file into response content, returns a `HttpResponse`.
 * User should specify content type if needed.
 *
 * @param {string} name template name, with or without extension
 * @param {object} locals local bindings
 * @param {string} [mimeType] custom mimeType, default to 'text/html'
 * @returns {http::Response}
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
    let engine = engines[ext] || module_loader(ext);
    return new Response(engine.sync ? engine(filename, locals) : co.sync(engine, filename, locals), {
        headers: {
            'Content-Type': mimeType || defaultMimeType
        }
    });
}

import fs_cache from 'fs_cache';

/**
 * @example
 *
 *     import * as view from 'module/view';
 *
 *     view.engines.handlebars = view.engine(require('handlebars').compile)
 *
 * @param {function} [compiler]
 * @param {object} [options]
 */
export function engine(compiler, options) {
    options || (options = {});

    options.handler = buffer => compiler(buffer + '');
    const reader = fs_cache(options);

    function engine(filename, obj) {
        return reader(filename).content(obj);
    }

    engine.sync = true;
    return engine;
}
