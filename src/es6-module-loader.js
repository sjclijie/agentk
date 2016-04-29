//
"use strict";

const parseOptions = {
    sourceType: 'module',
    loc: true
}, transformOptions = require('./javascript/transform_options'), buildOptions = {
    loc: true
};

const path = require('path'), fs = require('fs'), vm = require('vm');


const esprima = require('./javascript/esprima');
const build = require('./javascript/builder');
const transform = require('./javascript/transformer');
const moduleDefault = Symbol('module default'), loadProgress = Symbol('load progress');
const co = require('./co');

const definedModules = {}; // name: Primise(module)

exports.cache = definedModules;

global.include = function (name) {
    return include(name).then(function (module) {
        return module[loadProgress]
    })
};


/**
 * @param {String} name full path of the module name
 * @returns {Promise} a promise that resolves the module
 */
function include(name) {
    if (!/\.(\w+)$/.test(name)) {
        name += '.js';
    }
    if (name in definedModules) return definedModules[name];

    if (fs.existsSync(name)) {
        try {
            let source = fs.readFileSync(name);
            let module = {}, ret = definedModules[name] = Promise.resolve(module);
            defineModule(module, source, {filename: name});
            return ret;
        } catch (e) { // file IO error, or module compilation failed
            return definedModules[name] = Promise.reject(e);
        }
    }
    let basename = path.basename(name);
    console.error('downloading module ' + basename);
    return definedModules[name] = require('./publish').download(basename).then(function (buffer) {
        ensureParentDir(name);
        fs.writeFileSync(name, buffer);
        let module = {};
        defineModule(module, buffer, {filename: name});
        return module;
    })
}

function ensureParentDir(name) {
    let dir = path.dirname(name);
    if (fs.existsSync(dir)) return;
    ensureParentDir(dir);
    fs.mkdirSync(dir);
}

// init property for module default getter
const defaultProp = {
    configurable: true,
    get: function () {
        return co.yield(this[loadProgress])[moduleDefault];
    }
};

function initModule(module, names) {
    let props = {};
    names.forEach(function (name) {
        props[name] = {
            configurable: true,
            get: function () {
                return co.yield(this[loadProgress])[name];
            }, set: function (val) {
                co.yield(this[loadProgress])[name] = val;
            }
        }
    });
    props[moduleDefault] = defaultProp;
    Object.defineProperties(module, props);
}

const resolvedPaths = {};
const _load = require('module')._load;

function resolveModulePath(dir) {
    if (dir in resolvedPaths) return resolvedPaths[dir];

    let paths = dir === '/' || dir[dir.length - 1] === '\\' ? [] : resolveModulePath(path.dirname(dir)),
        curr = path.join(dir, 'node_modules');
    if (fs.existsSync(curr)) {
        paths = paths.slice();
        paths.unshift(curr)
    }
    return resolvedPaths[dir] = paths
}

// returns: [exports, script]
const compile = function () {
    let compiled;
    try {
        let cache = _load('node-shared-cache', {paths: module.paths.concat(resolveModulePath(process.cwd()))})
        // make a 8MB memory cache
        compiled = new cache.Cache('ak_compiled', 8 << 20, cache.SIZE_2K);
    } catch (e) {
        return compile;
    }

    const crypto = require('crypto');
    return function (buffer) {
        const hash = crypto.createHash('sha1').update(buffer).digest('base64').slice(0, -1);
        return compiled[hash] || (compiled[hash] = compile(buffer))
    }
    function compile(buffer) {
        let ast = esprima.parse(buffer, parseOptions);

        ast = transform(ast, transformOptions);
        const script = build(ast, buildOptions);
        return [Object.keys(ast.exports), script]
    }
}();

function defineModule(module, buffer, option) {
    const __filename = option.filename,
        __dirname = option.dir = path.dirname(__filename);
    let compiled;
    try {
        compiled = compile(buffer);
    } catch (e) {
        throw new Error('failed parsing ' + __filename + ': ' + e.message)
    }
    option.exports = compiled[0];
    //console.log(option.filename, result);
    let ctor = vm.runInThisContext(compiled[1], option);

    module[loadProgress] = co.run(function () {
        initModule(module, option.exports);
        option.exports = null; // TODO: sub-module exports analyse
        option.id = __filename;
        option.paths = resolveModulePath(__dirname);

        ctor(module, co, function (path) {
            return _load(path, option)
        }, function (name) {
            return co.yield(include(path.resolve(__dirname, name)))
        }, __filename, __dirname, moduleDefault, loadProgress);
        return module;
    });
}
