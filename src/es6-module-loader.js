"use strict";
const esprima = require('./esprima'),
    Syntax = esprima.Syntax,
    fs = require('fs'),
    path = require('path'),
    vm = require('vm'),
    co = require('./co'),
    crypto = require('crypto'),
    Module = require('module');
const definedModules = {}; // name: Primise(module)

let moduleCache;

try {
      let cache = require('node-shared-cache');
      moduleCache = new cache.Cache('agentk-module-cache', 1 << 20, cache.SIZE_1K);
} catch (e) {
}

let handleTemplate = false,
    handleClass = false,
    handleShorthand = false,
    handleRest = false;

try {
    (0, eval)('``');
} catch (e) {
    handleTemplate = true;
}
try {
    (0, eval)('(class{})');
} catch (e) {
    handleClass = true;
}
try {
    (0, eval)('({NaN})');
} catch (e) {
    handleShorthand = true;
}
try {
    (0, eval)('(function(...a){})');
} catch (e) {
    handleRest = true;
}

const System = global.System || (global.System = {});

const loadProgress = Symbol('loadProgress'),
    moduleDefault = Symbol.for('default');

/**
 * @param {String} name full path of the module name
 * @param {String} __dirname full path of the module name
 * @returns {Promise} a promise that resolves the module
 */
function include(name, __dirname) {
    if (name in definedModules) return definedModules[name];

    if (!/\.(\w+)$/.test(name)) {
        name += '.js';
    }
    if (__dirname) {
        name = path.resolve(__dirname, name);

        if (name in definedModules) return definedModules[name];
    }

    if (fs.existsSync(name)) {
        try {
            return definedModules[name] = Promise.resolve(System.module(fs.readFileSync(name, 'utf8'), {filename: name}));
        } catch (e) { // file IO error, or module compilation failed
            return definedModules[name] = Promise.reject(e);
        }
    }
    let basename = path.basename(name);
    console.error('downloading module ' + basename);
    return definedModules[name] = require('./publish').download(basename).then(function (buffer) {
        ensureParentDir(name);
        fs.writeFileSync(name, buffer);
        return System.module(buffer.toString(), {filename: name})
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
                //console.log('getting ' + name);
                return co.yield(this[loadProgress])[name];
            }, set: function (val) {
                //console.log('setting ' + name);
                co.yield(this[loadProgress])[name] = val;
            }
        }
    });
    props[moduleDefault] = defaultProp;
    Object.defineProperties(module, props);
}

function onModuleLoad(module) {
    return module[loadProgress];
}

System['import'] = function (name) {
    return include(name).then(onModuleLoad);
};

/**
 * method called inside module, yields the module when source is parsed
 * @param {string} name The full path of the module to be loaded
 * @param {string} __dirname The full path of the module to be loaded
 * @return The module
 */
function importer(name, __dirname) {
    return co.yield(include(name, __dirname))
}

const resolvedPaths = {};

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

System.module = function (source, option) {
    option = option || {filename: '/'};
    option.dir = path.dirname(option.filename);
    let result;
    if (moduleCache) {
        let checksum = crypto.createHash('sha1').update(source).digest('utf16le');
        result = moduleCache[checksum];
        if (!result) {
            result = moduleCache[checksum] = compile(source, option);
        }
    } else {
        result = compile(source, option);
    }
    // console.log(option.filename, result);
    let ctor = vm.runInThisContext(result, option);
    // console.log(option, result, ctor);

    let module = {};
    module[loadProgress] = co.run(function () {
        option.paths = resolveModulePath(option.dir);
        option.id = option.filename;
        ctor(module, co, importer, Module.prototype.require.bind(option), option.filename, option.dir, moduleDefault, initModule);
        return module;
    });
    return module;
};

System.set = function (name, module) {
    definedModules[name] = Promise.resolve(module);
};

System.define = function (name, source, option) {
    System.set(name, System.module(source, option));
};

const parseOption = {
    sourceType: 'module',
    range: true
};

function compile(source, option) {
    let parsed;
    try {
        parsed = esprima.parse(source, parseOption);
    } catch (e) {
        throw new Error("Error parsing file " + option.filename + ": " + e.message)
    }
    const replacer = createReplacement(source),
        replace = replacer.replace,
        insert = replacer.insert,
        globals = Object.create(null);
    let hasAliasedImport = findImports(parsed, globals, replace, option);
    let exports = findExports(parsed, replace, insert);

    if (hasAliasedImport || handleTemplate) {
        handleScope(parsed, globals, replace, insert);

        if (hasAliasedImport && exports[1]) {// replace exports
            const exports_replacer = createReplacement(exports[1]);
            let parsed_export = esprima.parse(exports[1], parseOption);
            handleScope(parsed_export, globals, exports_replacer.replace, exports_replacer.insert);
            exports[1] = exports_replacer.concat();
        }
    }

    return '(function(module, co, include, require, __filename, __dirname, moduleDefault, initModule) {"use strict";'
        + exports[0] + replacer.concat() + exports[1] + exports[2] + '})';
}

function createReplacement(source) {
    const replaces = [];
    return {
        replace: function (target, replacement) {
            let range = target.range;
            range.push(replacement);
            replaces.push(range);
        },
        concat: function () {
            if (!replaces.length) return source;
            replaces.sort((a, b) => a[0] - b[0]);

            let result = '', currentPos = 0;
            for (let repl of replaces) {
                result += source.substring(currentPos, repl[0]) + repl[2];
                currentPos = repl[1];
            }
            result += source.substring(currentPos);
            return result;
        },
        insert: function (pos, str) {
            replaces.push([pos, pos, str]);
        }
    }
}

function findExports(body, replace, insert) {
    let names = [], locals = {}, consts = {}, hasDefault = false;
    for (let i = 0, arr = body.body, L = arr.length; i < L; i++) {
        let stmt = arr[i];
        if (stmt.type === Syntax.ExportNamedDeclaration) {
            let decl = stmt.declaration;
            if (decl) { // export var | export function
                if (decl.type == Syntax.FunctionDeclaration
                    || decl.type === Syntax.ClassDeclaration) {
                    names.push(decl.id.name);
                } else if (decl.type === Syntax.VariableDeclaration) {
                    const isconst = decl.kind === 'const';
                    for (let vardecl of decl.declarations) {
                        const id = vardecl.id.name;
                        names.push(id);
                        if (isconst) {
                            consts[id] = true;
                        }
                    }
                }
                arr[i] = decl;
                replace({range: [stmt.range[0], decl.range[0]]}, '');
            } else { // export {xxx}
                for (let spec of stmt.specifiers) {
                    names.push(spec.exported.name);
                    if (spec.local.name !== spec.exported.name) {
                        locals[spec.exported.name] = spec.local.name;
                    }
                }
                stmt.type = null;
                replace(stmt, '');
            }
        } else if (stmt.type === Syntax.ExportDefaultDeclaration) {
            if (hasDefault) {
                throw new Error("export default has already been declared");
            }
            hasDefault = true;
            let defaultName = null;
            if (stmt.declaration.type === Syntax.FunctionDeclaration || stmt.declaration.type === Syntax.ClassDeclaration) {
                arr[i] = stmt.declaration;
                defaultName = stmt.declaration.id;
            } else {
                arr[i] = {
                    type: Syntax.ExpressionStatement,
                    expression: stmt.declaration
                }
            }

            if (defaultName) {
                replace({range: [stmt.range[0], stmt.declaration.range[0]]}, '');
                insert(stmt.range[1], 'Object.defineProperty(module,moduleDefault,{value:' + defaultName.name + '});');
            } else { // as expression
                replace({range: [stmt.range[0], stmt.declaration.range[0]]}, 'Object.defineProperty(module,moduleDefault,{value:');
                insert(stmt.declaration.range[1], '});');
            }
        } else if (stmt.type === Syntax.VariableDeclaration && stmt.kind === 'const') {
            for (let vardecl of stmt.declarations) {
                consts[vardecl.id.name] = true;
            }
        } // TODO: export all
    }

    //console.log(names);
    let head = 'initModule(module, ' + JSON.stringify(names) + ');', tail;
    if (names.length) {
        tail = ';\nObject.defineProperties(module, {\n';
        for (let name of names) {
            let local = name in locals ? locals[name] : name,
                isconst = local in consts;
            tail += '' + JSON.stringify(name);
            if (isconst) {
                tail += ':{value:' + local + '},\n'
            } else {
                tail += ':{get:function(){return ' + local + '}, set:function(_' + local + '){' + local + '=_' + local + '}' + '},\n'
            }
        }
        tail = tail.substr(0, tail.length - 2) + '\n});';
    } else {
        tail = '';
    }
    let trailer = hasDefault ? '' : '\nObject.defineProperty(module,moduleDefault,{value:undefined});';
    return [head, tail, trailer];
}

const VARIABLE_TYPE = {type: 'variable'};
function findImports(body, globals, replace, option) {
    let hasAliasedImport = false;
    let definedModules = {}, lastModuleUid = 0;
    for (let stmt of body.body) {
        if (stmt.type != Syntax.ImportDeclaration) continue;
        stmt.type = null;
        let moduleId = '$$' + stmt.source.value.replace(/\W+/g, '_'),
            moduleLocal = {
                type: 'imported',
                moduleId: ''
            };

        if (!stmt.specifiers.length) { // import only
            stmt.range.push();
            replace(stmt, 'include(' + stmt.source.raw + ',__dirname);');
            continue;
        }
        let lastSpecifier = stmt.specifiers.pop();
        if (lastSpecifier.type === Syntax.ImportNamespaceSpecifier) {
            moduleId = lastSpecifier.local.name;
            globals[moduleId] = VARIABLE_TYPE;
        } else {
            hasAliasedImport = true;
            stmt.specifiers.push(lastSpecifier); // put it back
            if (moduleId in definedModules) {
                moduleId += '$' + lastModuleUid++;
            }
        }

        for (let specifier of stmt.specifiers) {
            switch (specifier.type) {
                case Syntax.ImportDefaultSpecifier: // import default
                    globals[specifier.local.name] = {
                        type: 'imported',
                        replacement: moduleId + '[moduleDefault]'
                    };
                    break;
                case Syntax.ImportSpecifier: // import normal
                    globals[specifier.local.name] = {
                        type: 'imported',
                        replacement: moduleId + '.' + specifier.imported.name
                    };
            }
        }
        moduleLocal.moduleId = moduleId;
        definedModules[moduleId] = true;
        replace(stmt, 'let ' + moduleId + '=include(' + stmt.source.raw + ',__dirname);');
    }
    return hasAliasedImport;
}
function handleScope(body, locals, replace, insert) {
    //console.log('handle scope', body.type, body.range);
    body.body.forEach(handleVarAndFunc);
    body.body.forEach(handleStatement);

    function handleVarAndFunc(stmt) {
        if (stmt.type === Syntax.VariableDeclaration) {
            if (stmt.kind === 'var') {
                stmt.type = null;
                stmt.declarations.forEach(handleDeclerator);
            }
        } else if (stmt.type === Syntax.FunctionDeclaration) {
            stmt.id && (locals[stmt.id.name] = VARIABLE_TYPE);
            handleFunction(stmt);
            stmt.type = null;
        }
    }

    function handleStatement(stmt) {
        //console.log('stmt', stmt);
        switch (stmt.type) {
            case Syntax.ExpressionStatement:
                handleExpr(stmt.expression);
                break;
            case Syntax.ImportDeclaration:
                throw new Error('unexpected import declaration');
            case Syntax.VariableDeclaration:
                stmt.declarations.forEach(handleDeclerator);
                break;
            case Syntax.BlockStatement:
                handleScope(stmt, {__proto__: locals}, replace, insert);
                break;
            case Syntax.IfStatement:
                handleExpr(stmt.test);
                handleBlockOrStatement(stmt.consequent);
                handleBlockOrStatement(stmt.alternate);
                break;
            case Syntax.DoWhileStatement:
            case Syntax.WhileStatement:
                handleExpr(stmt.test);
                handleBlockOrStatement(stmt.body);
                break;
            case Syntax.ForStatement:
            {
                let oldScope = locals;
                stmt.init && handleDeclOrExpr(stmt.init);
                stmt.test && handleExpr(stmt.test);
                stmt.update && handleExpr(stmt.update);
                handleBlockOrStatement(stmt.body);
                locals = oldScope;
                break;
            }
            case Syntax.ForOfStatement:
            case  Syntax.ForInStatement:
            {
                let oldScope = locals;
                handleDeclOrExpr(stmt.left);
                handleExpr(stmt.right);
                handleBlockOrStatement(stmt.body);
                locals = oldScope;
                break;
            }
            case Syntax.TryStatement:
            {
                handleBlockOrStatement(stmt.block);
                for (let handler of stmt.handlers) {
                    let scope = {__proto__: locals};
                    scope[handler.param.name] = VARIABLE_TYPE;
                    handleScope(handler.body, scope, replace, insert);
                }
                handleBlockOrStatement(stmt.finalizer);
                break;
            }
            case Syntax.LabeledStatement:
                handleStatement(stmt.body);
                break;
            case Syntax.ThrowStatement:
            case Syntax.ReturnStatement:
                stmt.argument && handleExpr(stmt.argument);
                break;
            case Syntax.SwitchStatement:
                handleExpr(stmt.discriminant);
                for (let kase of stmt.cases) {
                    kase.test && handleExpr(kase.test);
                    kase.consequent.forEach(handleStatement);
                }
                break;
            case Syntax.ClassDeclaration:
                if (handleClass) {
                    let body = stmt.body.body;
                    let className = body.className = stmt.id ? stmt.id.name : 'constructor';
                    body.forEach(handleStatement);
                    replace({
                        range: [stmt.range[0], stmt.body.range[0] + 1]
                    }, (stmt.id ? 'let ' + className + ' = ' : '') + 'function (super_proto) {' +
                        (body.has_constructor ? '' : 'function ' + className + '() {return super_proto.constructor.apply(this,arguments)}') +
                        'const proto = ' + className + '.prototype = {__proto__: super_proto, constructor: ' + className + '};');
                    replace({
                        range: [stmt.body.range[1] - 1, stmt.range[1]]
                    }, 'return ' + className + '}(' + (stmt.superClass ? stmt.superClass.name : 'Object') + '.prototype);');
                } else {
                    stmt.body.body.forEach(handleStatement);
                }
                break;
            case Syntax.MethodDefinition:
                if (!handleClass) { // do nothing
                } else if (stmt.kind === 'constructor') {
                    replace(stmt.key, 'function ' + arguments[2].className);
                    arguments[2].has_constructor = true;
                } else if (stmt.kind === 'get' || stmt.kind === 'set') {
                    if (stmt.key.type === Syntax.Identifier) {
                        replace({
                            range: [stmt.range[0], stmt.key.range[0]]
                        }, 'proto.__define' + stmt.kind[0].toUpperCase() + stmt.kind.substr(1) + 'ter__("');
                        insert(stmt.key.range[1], '", function');
                    } else {
                        replace({
                            range: [stmt.range[0], stmt.key.range[0]]
                        }, 'proto.__define' + stmt.kind[0].toUpperCase() + stmt.kind.substr(1) + 'ter__(');
                        replace({
                            range: [stmt.key.range[1], stmt.value.range[0]]
                        }, ', function ');
                    }
                    insert(stmt.range[1], ');')
                } else {
                    let receiver = stmt.static ? arguments[2].className : 'proto';
                    if (stmt.key.type === Syntax.Identifier) {
                        replace({
                            range: [stmt.range[0], stmt.key.range[1]]
                        }, receiver + '.' + stmt.key.name + ' = function');
                    } else {
                        replace({
                            range: [stmt.range[0], stmt.key.range[0]]
                        }, receiver + '[');
                        //insert(stmt.range[0] - 1, receiver);
                        insert(stmt.value.range[0], ' = function');
                    }
                    insert(stmt.range[1], ';');
                }
                handleFunction(stmt.value);
                break;
            case null:
            case Syntax.DebuggerStatement:
            case Syntax.EmptyStatement:
            case Syntax.BreakStatement:
            case Syntax.ContinueStatement:
                break;
            default:
                console.warn('unhandled stmt', stmt);
        }
    }

    function handleExpr(expr) {
        //console.log('expr', expr);
        switch (expr.type) {
            case Syntax.Literal:
            case Syntax.ThisExpression:
                break;
            case Syntax.Identifier:
            {
                //console.log('handle Identifier', expr.name, locals[expr.name]);
                let name = expr.name;
                if (!(name in locals) || locals[name] === VARIABLE_TYPE) break; // not defined or is variable
                replace(expr, locals[name].replacement);
                break;
            }
            case Syntax.UnaryExpression:
            case Syntax.UpdateExpression:
            case Syntax.YieldExpression:
                handleExpr(expr.argument);
                break;
            case Syntax.AssignmentExpression:
            case Syntax.BinaryExpression:
            case Syntax.LogicalExpression:
                handleExpr(expr.left);
                handleExpr(expr.right);
                break;
            case Syntax.ConditionalExpression:
                handleExpr(expr.test);
                handleExpr(expr.consequent);
                handleExpr(expr.alternate);
                break;
            case Syntax.CallExpression:
                if (expr.callee.type === Syntax.Super) { // super()
                    if (!expr['arguments'].length) {
                        replace(expr, 'super_proto.constructor.call(this)')
                    } else {
                        replace({
                            range: [expr.callee.range[0], expr['arguments'][0].range[0]]
                        }, 'super_proto.constructor.call(this, ')
                    }
                } else if (expr.callee.type === Syntax.MemberExpression && expr.callee.object.type === Syntax.Super) {
                    handleExpr(expr.callee.object);
                    if (!expr['arguments'].length) {
                        replace({
                            range: [expr.callee.range[1], expr.range[1]]
                        }, '.call(this)')
                    } else {
                        replace({
                            range: [expr.callee.range[1], expr['arguments'][0].range[0]]
                        }, '.call(this, ')
                    }
                } else {
                    handleExpr(expr.callee);
                }
                expr['arguments'].forEach(handleExpr);
                break;
            case Syntax.NewExpression:
                handleExpr(expr.callee);
                expr['arguments'].forEach(handleExpr);
                break;
            case Syntax.MemberExpression:
                handleExpr(expr.object);
                if (expr.computed) {
                    handleExpr(expr.property);
                }
                break;
            case Syntax.ArrowFunctionExpression:
            case Syntax.FunctionExpression:
                handleFunction(expr);
                break;
            case Syntax.ObjectExpression:
                for (let prop of expr.properties) {
                    if (prop.shorthand) {
                        handleShorthand && insert(prop.range[1], ':' + prop.value.name)
                    } else if (prop.method) {
                        handleShorthand && insert(prop.key.range[1], ': function')
                    } else if (prop.computed) {
                        handleExpr(prop.key);
                    }
                    handleExpr(prop.value);
                }
                break;
            //throw expr;
            case Syntax.ArrayExpression:
                expr.elements.forEach(handleExpr);
                break;
            case Syntax.ArrayPattern:
                handleDestruct(expr);
                break;
            case Syntax.SequenceExpression:
                expr.expressions.forEach(handleExpr);
                break;
            case Syntax.SpreadElement:
                handleExpr(expr.argument);
                break;
            case Syntax.TaggedTemplateExpression:
                handleExpr(expr.tag);
                if (handleTemplate) {
                    for (let quasi of expr.quasi.quasis) {
                        let repl = JSON.stringify(quasi.value.cooked);
                        if (quasi.range[0] > expr.quasi.range[0]) {
                            repl = '),' + repl;
                        } else {
                            repl = '({raw:[' + repl;
                        }
                        if (!quasi.tail) {
                            repl += ',(';
                        } else {
                            repl += ']})'
                        }
                        replace(quasi, repl)
                    }
                }
                expr.quasi.expressions.forEach(handleExpr);
                break;
            case Syntax.TemplateLiteral:
                if (handleTemplate) {
                    for (let quasi of expr.quasis) {
                        let repl = JSON.stringify(quasi.value.cooked);
                        if (quasi.range[0] > expr.range[0]) {
                            repl = ')+' + repl;
                        }
                        if (!quasi.tail) {
                            repl += '+(';
                        }
                        replace(quasi, repl)
                    }
                }
                expr.expressions.forEach(handleExpr);
                break;
            case  Syntax.Super:
                replace(expr, 'super_proto');
                break;
            default:
                console.warn('unhandled expr', expr);
        }
    }

    function handleDestruct(expr) {
        if (expr.type === Syntax.ObjectPattern) {
            for (let prop of expr.properties) {
                if (prop.shorthand) {
                    locals[prop.key.name] = VARIABLE_TYPE;
                } else {
                    handleDestruct(prop.value);
                }
            }
        } else if (expr.type === Syntax.ArrayPattern) {
            for (let elem of expr.elements) {
                if (elem.type === Syntax.Identifier) {
                    locals[elem.name] = VARIABLE_TYPE;
                } else {
                    handleDestruct(elem);
                }
            }
        } else if (expr.type === Syntax.RestElement) {
            locals[expr.argument.name] = VARIABLE_TYPE;
        } else if (expr.type === Syntax.MemberExpression) { // [a.b] = xxx
            handleExpr(expr);
        } else {
            throw new Error('unhandled destruct element type: ' + expr.type);
        }
    }

    function handleDeclOrExpr(stmt) {
        if (stmt.type === Syntax.VariableDeclaration) { // make a scope
            locals = {__proto__: locals};
            stmt.declarations.forEach(handleDeclerator);
        } else {
            handleExpr(stmt);
        }
    }

    function handleDeclerator(decl) {
        if (decl.id.type !== Syntax.Identifier) {
            handleDestruct(decl.id);
        } else {
            locals[decl.id.name] = VARIABLE_TYPE;
            decl.init && handleExpr(decl.init);
        }
    }

    function handleBlockOrStatement(stmt) {
        if (!stmt) return;
        if (stmt.type === Syntax.BlockStatement) {
            handleScope(stmt, {__proto__: locals}, replace, insert);
        } else {
            handleStatement(stmt);
        }
    }


    function handleFunction(expr) {
        for (let def of expr.defaults) {
            def && handleExpr(def);
        }
        let scope;
        if (expr.type === Syntax.FunctionExpression && expr.id) {
            scope = {
                __proto__: locals
            };
            scope[expr.id] = VARIABLE_TYPE;
        } else {
            scope = locals;
        }
        scope = {__proto__: scope};
        let params = expr.params, paramLen = params.length;
        if (paramLen) {
            for (let param of params) {
                scope[param.name] = VARIABLE_TYPE;
            }
            if (handleRest) {
                let lastParam = params[paramLen - 1];
                if (lastParam.type === Syntax.RestElement) {
                    if (paramLen === 1) {
                        replace(lastParam, '')
                    } else {
                        replace({
                            range: [params[paramLen - 2].range[1], lastParam.range[1]]
                        }, '')
                    }
                    if (expr.body.type === Syntax.BlockStatement) {
                        insert(expr.body.range[0] + 1, 'var ' + lastParam.argument.name + ' = Array.prototype.slice.call(arguments, ' + (paramLen - 1) + ');');
                    } else {
                        insert(expr.body.range[0], '{var ' + lastParam.argument.name + ' = Array.prototype.slice.call(arguments, ' + (paramLen - 1) + '); return (');
                        insert(expr.body.range[1], ')}');
                    }
                }
            }
        }
        if (expr.body.type === Syntax.BlockStatement) {
            handleScope(expr.body, scope, replace, insert);
        } else {
            let oldLocal = locals;
            locals = scope;
            handleExpr(expr.body);
            locals = oldLocal;
        }
    }
}
