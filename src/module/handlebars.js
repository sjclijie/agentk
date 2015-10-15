import fs_cache from 'fs_cache';

/**
 * @example
 *
 *     import * as view from 'module/view';
 *     import handlebars from 'module/handlebars';
 *
 *     view.engines.handlebars = handlebars()
 *
 * @param {object} [options]
 */
export default function handlebars(options) {
    options || (options = {});

    let compile = require('handlebars').compile;
    options.handler = buffer => compile(buffer + '');
    const reader = fs_cache(options);

    function engine(filename, obj) {
        return reader(filename).content(obj);
    }

    engine.sync = true;
    return engine;
}