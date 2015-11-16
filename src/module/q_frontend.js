import fs_cache from 'fs_cache';
import {read as file_read} from 'file';

/**
 * header footer helper
 *
 * @usage
 *
 *     // import module
 *     import {header_footer} from 'q_frontend';
 *
 *     // init header_footer helper
 *     Handlebars.registerHelper("header_footer", header_footer('../include'))
 *     // call helper in handlebars template:
 *     {{header_footer "header_main"}}
 *
 * @param {string} path
 * @param {number} [cached]
 * @returns {Function} a method that accepts a filename, and returns its content
 */
export function header_footer(path, cached) {
    let cache = fs_cache({
        cached: cached || 30e3,
        handler: String
    });

    let path_join = require('path').join;

    return function (name) {
        return cache(path_join(path, name.replace(/\./g, '/') + '.html')).content
    }
}

/**
 * @usage
 *
 *     // import module
 *     import {header_footer} from 'q_frontend';
 *
 *     // init ver
 *     view.engines.handlebars = view.engine(ver('../refs/ver/versions.mapping', Handlebars.compile));
 *
 * @param {string} path
 * @param {Function} compiler next stage compiler
 * @returns {Function} a method that compiles the source
 */
export function ver(path, compiler) {
    const reg = /((?:styles|scripts)\/[^@]+)@qzzversion(\.js|\.css)/g;
    const versions = {};
    file_read(path).toString().split('\n').forEach(function (i) {
        versions[i.slice(0, -33)] = i.slice(-32);
    });

    return function (source) {
        source = source.replace(reg, function (all, p1, p2) {
            return p1 + '@' + versions[p1 + p2] + p2;
        });
        return compiler(source);
    }
}

