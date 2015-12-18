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

let handleTemplate = false,
    handleClass = false,
    handleShorthand = false,
    handleDefaultParam = false,
    handleDestruct = false,
    arrowBindings = function () {
            return (() => this)()
        }.call(definedModules) === definedModules,
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
try {
    (0, eval)('(function(a=1){})');
} catch (e) {
    handleDefaultParam = true;
}

try {
    (0, eval)('(function({a}){})');
} catch (e) {
    handleDestruct = true
}

const loadProgress = Symbol('loadProgress'),
    moduleDefault = Symbol.for('default');
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
        ctor(module, co, function (name) {
            return co.yield(include(name, __dirname))
        }, _require.bind({
            id: __filename,
            paths: resolveModulePath(__dirname)
        }), __filename, __dirname, moduleDefault, loadProgress);
        return module;
    });

}

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
    let hasAliasedImport = findImports(parsed, globals, replace);
    let exports = findExports(parsed, replace, insert);
    option.exports = exports[0];

    handleScope(parsed, globals, replace, insert, replacer.slice);

    if (hasAliasedImport && exports[1]) {// replace exports
        const exports_replacer = createReplacement(exports[1]);
        let parsed_export = esprima.parse(exports[1], parseOption);
        handleScope(parsed_export, globals, exports_replacer.replace, exports_replacer.insert, exports_replacer.slice);
        exports[1] = exports_replacer.concat();
    }

    return '(function(module, co, include, require, __filename, __dirname, moduleDefault, loadProgress) {"use strict";'
        + replacer.concat() + exports[1] + exports[2] + '})';
}

function createReplacement(source) {
    const replaces = [];
    let nextIdx = 0;
    return {
        replace: function (target, replacement) {
            let range = target.range;
            range.push(nextIdx++, replacement);
            replaces.push(range);
        },
        concat: function () {
            if (!replaces.length) return source;
            replaces.sort((a, b) => {
                let ret = a[0] - b[0];
                return ret || a[2] - b[2];
            });

            let result = '', currentPos = 0;
            for (let repl of replaces) {
                result += source.substring(currentPos, repl[0]) + repl[3];
                currentPos = repl[1];
            }
            result += source.substring(currentPos);
            return result;
        },
        insert: function (pos, str) {
            replaces.push([pos, pos, nextIdx++, str]);
        },
        slice: function (elem) {
            return source.slice(elem.range[0], elem.range[1])
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
        } else if (stmt.type === Syntax.VariableDeclaration && stmt.kind === 'const') {
            for (let vardecl of stmt.declarations) {
                consts[vardecl.id.name] = true;
            }
        } // TODO: export all
    }

    let tail;
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
    return [names, tail, trailer];
}

const VARIABLE_TYPE = {type: 'variable'};
function findImports(body, globals, replace) {
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
            replace(stmt, 'include(' + stmt.source.raw + ')[loadProgress].done();');
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
        replace(stmt, 'const ' + moduleId + '=include(' + stmt.source.raw + ');');
    }
    return hasAliasedImport;
}
function handleScope(body, locals, replace, insert, slice) {
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
        switch (stmt.type) {
            case Syntax.ExpressionStatement:
                handleExpr(stmt.expression);
                break;
            case Syntax.ImportDeclaration:
                throw new Error('unexpected import declaration');
            case Syntax.ExportDefaultDeclaration:
                if (stmt.declaration.type === Syntax.FunctionDeclaration) {
                    handleFunction(stmt.declaration);
                } else if (stmt.declaration.type === Syntax.ClassDeclaration) {
                    handleStatement(stmt.declaration);
                } else {
                    handleExpr(stmt.declaration)
                }
                if (stmt.declaration.id) {
                    replace({range: [stmt.range[0], stmt.declaration.range[0]]}, '');
                    insert(stmt.range[1], '\nObject.defineProperty(module,moduleDefault,{value:' + stmt.declaration.id.name + '});');
                } else {
                    replace({range: [stmt.range[0], stmt.declaration.range[0]]}, '\nObject.defineProperty(module,moduleDefault,{value:');
                    insert(stmt.declaration.range[1], '});');
                }
                break;
            case Syntax.VariableDeclaration:
                stmt.declarations.forEach(handleDeclerator);
                break;
            case Syntax.BlockStatement:
                handleScope(stmt, {__proto__: locals}, replace, insert, slice);
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
                    handleScope(handler.body, scope, replace, insert, slice);
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
            {
                let superClass = stmt.superClass;
                superClass && handleExpr(superClass);
                if (handleClass) {
                    let body = stmt.body.body;
                    let className = body.className = stmt.id ? stmt.id.name : 'constructor';
                    body.forEach(handleStatement);
                    const bodyStart = stmt.body.range[0];

                    replace({
                            range: [stmt.range[0], superClass ? superClass.range[0] : bodyStart]
                        }, (stmt.id ? 'let ' + className + ' = ' : '') + 'function () {const super_proto = (' +
                        (superClass ? '' : 'Object')
                    );
                    replace({
                        range: [bodyStart, bodyStart + 1]
                    }, ').prototype;' + (body.has_constructor ? '' : 'function ' + className + '() {return super_proto.constructor.apply(this,arguments)}') +
                        'const proto = ' + className + '.prototype = {__proto__: super_proto, constructor: ' + className + '};');

                    replace({
                        range: [stmt.body.range[1] - 1, stmt.range[1]]
                    }, 'return ' + className + '}();');
                } else {
                    stmt.body.body.forEach(handleStatement);
                }
                break;
            }
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
        if (!expr) return;
        switch (expr.type) {
            case Syntax.Literal:
            case Syntax.ThisExpression:
                break;
            case Syntax.Identifier:
            {
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
                if (handleDestruct && expr.left.type === Syntax.ArrayPattern) {
                    let varName = '_tmp' + expr.right.range[0], assigns = '';
                    const onPattern = function onPattern(pattern, prefix) {
                        if (pattern.type === Syntax.ObjectPattern) {
                            for (let prop of pattern.properties) {
                                if (prop.shorthand) {
                                    assigns += '; ' + prop.key.name + ' = ' + prefix + '.' + prop.key.name
                                } else {
                                    onPattern(prop.value, prefix + '.' + prop.key.name)
                                }
                            }
                        } else if (pattern.type === Syntax.ArrayPattern) {
                            for (let i = 0, L = pattern.elements.length; i < L; i++) {
                                let elem = pattern.elements[i];
                                if (!elem) continue;
                                let path = prefix + '[' + i + ']';
                                if (elem.type === Syntax.Identifier) {
                                    assigns += '; ' + elem.name + ' = ' + path
                                } else if (elem.type === Syntax.ArrayPattern) {
                                    onPattern(elem, path)
                                } else {
                                    assigns += '; ' + slice(elem) + ' = ' + path
                                }
                            }
                        }
                    };

                    onPattern(expr.left, varName);
                    replace(expr.left, 'const ' + varName);
                    handleExpr(expr.right);
                    insert(expr.right.range[1], assigns);
                    break;
                }
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
                if (!handleClass) {
                    handleExpr(expr.callee);
                } else if (expr.callee.type === Syntax.Super) { // super()
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
                if (handleClass) replace(expr, 'super_proto');
                break;
            default:
                console.warn('unhandled expr', expr);
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
        const id = decl.id;
        if (id.type === Syntax.Identifier) {
            locals[id.name] = VARIABLE_TYPE;
            decl.init && handleExpr(decl.init);
        } else {
            let varName = '_tmp' + decl.init.range[0], assigns = '';
            const onPattern = function onPattern(pattern, prefix) {
                if (pattern.type === Syntax.ObjectPattern) {
                    for (let prop of pattern.properties) {
                        if (prop.value.type === Syntax.Identifier) {
                            locals[prop.value.name] = VARIABLE_TYPE;
                            if (handleDestruct) assigns += ', ' + prop.value.name + ' = ' + prefix + '.' + prop.key.name
                        } else {
                            onPattern(prop.value, prefix + '.' + prop.key.name)
                        }
                    }
                } else if (pattern.type === Syntax.ArrayPattern) {
                    for (let i = 0, L = pattern.elements.length; i < L; i++) {
                        let elem = pattern.elements[i];
                        if (!elem) continue;
                        if (elem.type === Syntax.Identifier) {
                            locals[elem.name] = VARIABLE_TYPE;
                            if (handleDestruct)assigns += ', ' + elem.name + ' = ' + prefix + '[' + i + ']'
                        } else {
                            onPattern(elem, prefix + '[' + i + ']')
                        }
                    }
                }
            };

            onPattern(id, varName);
            if (handleDestruct) {
                replace(id, varName);
                insert(decl.init.range[1], assigns);
            }
        }
    }

    function handleBlockOrStatement(stmt) {
        if (!stmt) return;
        if (stmt.type === Syntax.BlockStatement) {
            handleScope(stmt, {__proto__: locals}, replace, insert, slice);
        } else {
            handleStatement(stmt);
        }
    }


    function handleFunction(expr) {
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

        let isBlockBody = expr.body.type === Syntax.BlockStatement;

        if (paramLen) {
            let hasDefaults = false;
            for (let i = 0; i < paramLen; i++) {
                let param = params[i];
                scope[param.name] = VARIABLE_TYPE;
                if (handleDefaultParam) {
                    let def = expr.defaults[i];
                    if (def) {
                        hasDefaults = true;
                        handleExpr(def);
                    }
                }
            }
            let hasRest = false, bodyStarts = expr.body.range[0], bodyEnds = expr.body.range[1];
            if (handleRest) {
                let lastParam = params[paramLen - 1];
                if (lastParam.type === Syntax.RestElement) {
                    hasRest = true
                }
            }
            if (hasDefaults) {

                let names = '', inits = '';
                for (let i = 0; i < paramLen - 1; i++) {
                    let param = params[i];
                    names += param.name + ', ';
                    let def = expr.defaults[i];
                    if (def) {
                        inits += 'typeof ' + param.name + ' === "undefined" && (' + param.name + ' = ' + slice(def) + ');'
                    }
                }

                let lastParam = params[paramLen - 1];
                if (hasRest) {
                    names = names.substr(0, names.length - 2);
                } else {
                    names += lastParam.name;
                    inits += 'typeof ' + lastParam.name + ' === "undefined" && (' + lastParam.name + ' = ' + slice(expr.defaults[paramLen - 1]) + ');'
                }
                let prefix;
                if (expr.type === Syntax.ArrowFunctionExpression) {
                    prefix = names + ') => {'
                } else {
                    prefix = names + ') {'
                }

                if (hasRest) {
                    prefix += 'var ' + lastParam.argument.name + ' = Array.prototype.slice.call(arguments, ' + (paramLen - 1) + ');'
                }
                prefix += inits;
                let suffix;
                if (isBlockBody) {
                    prefix += 'return ' + (arrowBindings ? '(() => ' : '(function(' + names + ') {');
                    suffix = arrowBindings ? ')()}' : ').call(this, ' + names + ')}';
                } else {
                    prefix += 'return ' + (arrowBindings ? '(() => ' : '(function(' + names + ') {return ');
                    suffix = arrowBindings ? ')()}' : '}).call(this, ' + names + ')}';
                }
                replace({
                    range: [params[0].range[0], isBlockBody ? bodyStarts + 1 : bodyStarts]
                }, prefix);
                replace({
                    range: [bodyEnds, expr.range[1]]
                }, suffix);


            } else if (hasRest) {
                let lastParam = params[paramLen - 1];
                if (paramLen === 1) {
                    replace(lastParam, '')
                } else {
                    replace({
                        range: [params[paramLen - 2].range[1], lastParam.range[1]]
                    }, '')
                }

                if (isBlockBody) {
                    insert(bodyStarts + 1, 'var ' + lastParam.argument.name + ' = Array.prototype.slice.call(arguments, ' + (paramLen - 1) + ');');
                } else {
                    replace({
                        range: [lastParam.range[1], bodyStarts]
                    }, ') => {var ' + lastParam.argument.name + ' = Array.prototype.slice.call(arguments, ' + (paramLen - 1) + '); return ');

                    replace({
                        range: [bodyEnds, expr.range[1]]
                    }, '}')
                }
            }


        }
        if (isBlockBody) {

            handleScope(expr.body, scope, replace, insert, slice);
        } else {
            let oldLocal = locals;
            locals = scope;
            handleExpr(expr.body);
            locals = oldLocal;
        }
    }
}
