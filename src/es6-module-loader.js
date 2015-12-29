// 针对javascript的语法树调整/编译/处理工具
"use strict";

const parseOptions = {
    sourceType: 'module',
    loc: true
}, transformOptions = require('./javascript/transform_options');

const path = require('path'), fs = require('fs'), Module = require('module'), vm = require('vm');


const esprima = require('./javascript/esprima');
const build = require('./javascript/builder');
const transform = require('./javascript/transformer');
const moduleDefault = Symbol('module default'), loadProgress = Symbol('load progress');
const co = require('./co');

const definedModules = {}; // name: Primise(module)


global.include = function (name) {
    return include(name).then(function (module) {
        return module[loadProgress]
    })
};

/**
 * @param {String} name full path of the module name
 * @param {String} __dirname full path of the module name
 * @returns {Promise} a promise that resolves the module
 */
function include(name, __dirname) {
    if (!/\.(\w+)$/.test(name)) {
        name += '.js';
    }
    if (__dirname) {
        name = path.resolve(__dirname, name);
    }
    if (name in definedModules) return definedModules[name];

    if (fs.existsSync(name)) {
        try {
            let source = fs.readFileSync(name, 'utf8');
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
        defineModule(module, buffer.toString(), {filename: name});
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
const _require = Module.prototype.require;

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

function defineModule(module, source, option) {
    const __filename = option.filename,
        __dirname = option.dir = path.dirname(__filename);
    let result = compile(source, option);
    //console.log(option.filename, result);
    let ctor = vm.runInThisContext(result, option);

    module[loadProgress] = co.run(function () {
        initModule(module, option.exports);
        option.exports = null; // TODO: sub-module exports analyse
        ctor(module, co, _require.bind({
            id: __filename,
            paths: resolveModulePath(__dirname)
        }), function (name) {
            return co.yield(include(name, __dirname))
        }, __filename, __dirname, moduleDefault, loadProgress);
        return module;
    });
}

function compile(source, option) {
    //console.time('parse ' + option.filename);
    let ast = esprima.parse(source, parseOptions);
    //console.timeEnd('parse ' + option.filename);

    //console.time('transform');
    ast = transform(ast, transformOptions);
    //console.timeEnd('transform');

    //console.time('build');
    const target = build(ast);
    //console.timeEnd('build');
    //fs.writeFileSync('out/' + option.filename.replace(/\W+/g, '_') + '.js', target);
    option.exports = Object.keys(ast.exports);
    return target;
}