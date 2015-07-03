"use strict";
const esprima = require('./esprima'),
    Syntax = esprima.Syntax,
    fs = require('fs'),
    path = require('path'),
    vm = require('vm'),
    co = require('./co'),
    Module = require('module');

const definedModules = {}; // name: Primise(module)

let handleTemplate = false;

try {
    (0, eval)('``');
} catch (e) {
    handleTemplate = true;
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
    if (name[0] !== '/') {
        name = path.join(__dirname, name);
        if (name in definedModules) return definedModules[name];
    }


    if (fs.existsSync(name)) {
        try {
            return Promise.resolve(System.module(fs.readFileSync(name, 'utf8'), {filename: name}));
        } catch (e) { // file IO error, or module compilation failed
            return Promise.reject(e);
        }
    }
    let basename = path.basename(name), dir = path.dirname(name);
    console.log('try to download file %s into %s', basename, dir);
    return definedModules[name] = require('./publish').download(basename, dir)
}

function initModule(module, names) {
    let props = {};
    names.forEach(function (name) {
        props[name] = {
            configurable: true,
            get: function () {
                //console.log('getting ' + name);
                co.yield(module[loadProgress]);
                return module[name];
            }, set: function (val) {
                //console.log('setting ' + name);
                co.yield(module[loadProgress]);
                module[name] = val;
            }
        }
    });
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

System.module = function (source, option) {
    option = option || {filename: '/'};
    let result = compile(source, option);
    //console.log(result);
    let ctor = vm.runInThisContext(result, option);

    let module = {};
    module[loadProgress] = co.promise(function () {
        return ctor(module, co, importer, Module.prototype.require.bind(option), option.filename, option.dir, moduleDefault, initModule);
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
    let parsed = esprima.parse(source, parseOption);
    let replaces = [], globals = {};
    option = option || {filename: '/'};
    option.dir = path.dirname(option.filename);
    findImports(parsed, globals, replace, option);
    let exports = findExports(parsed, replace);

    handleScope(parsed, globals, replace);
    //console.log(globals, replaces);
    replaces.sort(function (a, b) {
        return a[0] - b[0];
    });
    let result = '(function(module, co, include, require, __filename, __dirname, moduleDefault, initModule) {"use strict";',
        currentPos = 0;
    if (exports) result += exports[0];

    for (let repl of replaces) {
        result += source.substring(currentPos, repl[0]) + repl[2];
        currentPos = repl[1];
    }
    result += source.substring(currentPos);

    if (exports) result += exports[1];
    result += '\nreturn module})';
    //console.log(option.filename, result);
    return result;

    function replace(target, replacement) {
        let range = target.range;
        range.push(replacement);
        replaces.push(range);
    }
}

function findExports(body, replace) {
    let names = [], locals = {};
    for (let i = 0, arr = body.body, L = arr.length; i < L; i++) {
        let stmt = arr[i];
        if (stmt.type === Syntax.ExportNamedDeclaration) { // export var | export function
            let decl = stmt.declaration;
            if (decl) {
                if (decl.type == Syntax.FunctionDeclaration) {
                    names.push(decl.id.name);
                } else if (decl.type === Syntax.VariableDeclaration) {
                    for (let vardecl of decl.declarations) {
                        names.push(vardecl.id.name);
                    }
                }
                arr[i] = decl;
                replace({range: [stmt.range[0], decl.range[0]]}, '');
            } else {
                for (let spec of stmt.specifiers) {
                    names.push([spec.exported.name, spec.local.name]);
                    if (spec.local.name !== spec.exported.name) {
                        locals[spec.exported.name] = spec.local.name;
                    }
                }
                stmt.type = null;
                replace(stmt, '');
            }
        } else if (stmt.type === Syntax.ExportDefaultDeclaration) {
            //console.log(stmt);
            replace({range: [stmt.range[0], stmt.declaration.range[0]]}, 'module[moduleDefault]=');
            if (stmt.declaration.type === Syntax.FunctionDeclaration) {
                arr[i] = stmt.declaration;
            } else {
                arr[i] = {
                    type: Syntax.ExpressionStatement,
                    expression: stmt.declaration
                }
            }
        }
    }

    //console.log(names);
    if (names.length) {
        let head = 'initModule(module, ' + JSON.stringify(names) + ');';
        let ret = ';\nObject.defineProperties(module, {\n';
        for (let name of names) {
            let local = name in locals ? locals[name] : name;
            ret += '' + JSON.stringify(name) + ':{get:function(){return ' + local + '}, set:function($_){' + local + '=$_}},\n'
        }
        ret = ret.substr(0, ret.length - 2) + '\n});';
        return [head, ret];
    }
    return null;
}

const VARIABLE_TYPE = {type: 'variable'};
function findImports(body, globals, replace, option) {
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
            stmt.specifiers.push(lastSpecifier);
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
}
function handleScope(body, locals, replace) {
    //console.log('handle scope', body.type, body.range);
    body.body.forEach(handleVarAndFunc);
    body.body.forEach(handleStatement);

    function handleVarAndFunc(stmt) {
        if (stmt.type === Syntax.VariableDeclaration) {
            if (stmt.kind === 'var') {
                stmt.type = null;
                for (let decl of stmt.declarations) {
                    handleDeclerator(decl);
                    decl.init && handleExpr(decl.init);
                }
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
                console.trace(stmt);
                throw new Error('unexpected import declaration');
            case Syntax.VariableDeclaration:
                for (let decl of stmt.declarations) {
                    handleDeclerator(decl);
                    decl.init && handleExpr(decl.init);
                }

                break;

            case Syntax.BlockStatement:
                handleScope(stmt, {__proto__: locals}, replace);
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
                    handleScope(handler.body, scope, replace);
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
            case Syntax.NewExpression:
            case Syntax.CallExpression:
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
                    if (prop.computed) {
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
        } else {
            throw expr;
        }
    }

    function handleDeclOrExpr(stmt) {
        if (stmt.type === Syntax.VariableDeclaration) { // make a scope
            locals = {__proto__: locals};
            handleDeclerator(stmt.declarations[0]);
        } else {
            handleExpr(stmt);
        }
    }

    function handleDeclerator(decl) {
        if (decl.id.type !== Syntax.Identifier) {
            handleDestruct(decl.id);
        } else {
            locals[decl.id.name] = VARIABLE_TYPE;
        }
    }

    function handleBlockOrStatement(stmt) {
        if (!stmt) return;
        if (stmt.type === Syntax.BlockStatement) {
            handleScope(stmt, {__proto__: locals}, replace);
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
        for (let param of expr.params) {
            scope[param.name] = VARIABLE_TYPE;
        }
        if (expr.body.type === Syntax.BlockStatement) {
            handleScope(expr.body, scope, replace);
        } else {
            let oldLocal = locals;
            locals = scope;
            handleExpr(expr.body);
            locals = oldLocal;
        }
    }
}
