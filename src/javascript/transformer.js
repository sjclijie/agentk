"use strict";
let handleStringTemplate, handleClass, handleRest;

const Syntax = require('./esprima').Syntax;

const params = ['module', 'co', 'require', 'include', '__filename', '__dirname', 'moduleDefault', 'loadProgress'].map(id),
    useStrict = expr(raw('"use strict"')),
    VariableType = {type: 'variable'},
    $proto = id('proto'),
    $super_proto = id('super_proto'),
    $dtemp = id('$dtemp'),
    $ptemp = {
        type: Syntax.VariableDeclaration,
        kind: 'var',
        declarations: [declarator(id('$ptemp')), declarator($dtemp)]
    }, $this = {type: Syntax.ThisExpression},
    $noDefault = expr(call(id('Object.defineProperty'), [id('module'), id('moduleDefault'), {
        type: Syntax.ObjectExpression,
        properties: [prop('value', id('undefined'))]
    }]));

let context = {}, exportedNames = {}, hasDestruct = false, hasDefault = false;

function transform(ast, options) {
    handleStringTemplate = options.StringTemplate;
    handleClass = options.Class;
    handleRest = options.Rest;

    let stmts = ast.body;
    stmts.forEach(onStmt);
    return stmts;
}

function id(name) {
    return {type: Syntax.Identifier, name: name}
}

function prop(key, $value) {
    return {type: Syntax.Property, key: id(key), value: $value}
}

function raw(str) {
    return {type: Syntax.Literal, raw: str}
}

function expr(node) {
    return {type: Syntax.ExpressionStatement, expression: node}
}

function call(callee, args) {
    return {type: Syntax.CallExpression, callee: callee, arguments: args}
}

function member(object, property) {
    return {type: Syntax.MemberExpression, object: object, property: id(property), computed: false}
}

function assign(left, right) {
    return {type: Syntax.AssignmentExpression, operator: '=', left: left, right: right};
}

function binary(left, operator, right) {
    return {type: Syntax.BinaryExpression, operator: operator, left: left, right: right};
}

function declarator(id, init) {
    return {type: Syntax.VariableDeclarator, id: id, init: init}
}

module.exports = function (ast, options) {
    const stmts = transform(ast, options);

    // handle exported
    const properties = [], exports = {};
    for (let key in exportedNames) {
        let val = exportedNames[key], name = val.name, varDecl = context[name], $name = id(name);
        if (!varDecl || (varDecl.kind === 'let' || varDecl.kind === 'const') && !val.found) throw new Error(name + ' not found in identifiers');
        let attrs;

        exports[key] = varDecl.kind;

        if (varDecl.kind === 'const') {
            attrs = [prop('value', $name)]
        } else {
            attrs = [prop('get', {
                type: Syntax.FunctionExpression,
                params: [],
                body: {
                    type: Syntax.BlockStatement,
                    body: [{
                        type: Syntax.ReturnStatement,
                        argument: $name
                    }]
                }
            }), prop('set', {
                type: Syntax.FunctionExpression,
                params: [id('_' + val.name)],
                body: {
                    type: Syntax.BlockStatement,
                    body: [expr(assign($name, id('_' + name)))]
                }
            })]
        }
        properties.push(prop(key, {
            type: Syntax.ObjectExpression,
            properties: attrs
        }))
    }

    properties.length && stmts.push(expr(call(id('Object.defineProperties'), [id('module'), {
        type: Syntax.ObjectExpression,
        properties: properties
    }])));


    if (stmts[0] && stmts[0].type === Syntax.ExpressionStatement && stmts[0].expression.type === Syntax.Literal && stmts[0].expression.value === 'use strict') {
    } else {
        stmts.unshift(useStrict);
    }
    if (!hasDefault) {
        stmts.push($noDefault)
    }

    hasDestruct && stmts.push($ptemp);
    hasDestruct = false;

    context = {};
    exportedNames = {};
    hasDefault = false;

    return {
        exports: exports,
        type: Syntax.Program,
        body: [expr({
            type: Syntax.FunctionExpression,
            id: null,
            params: params,
            body: {
                type: Syntax.BlockStatement,
                body: stmts
            }
        })]
    };
}

module.exports.transform = transform;

function onMethod(method, i, arr) {
    onExpr(method.value);
    if (!handleClass) {
        return;
    }
    let target = method.static ? arr.$className.name : 'proto';
    if (method.kind.length === 3) { // get|set
        method.type = Syntax.ExpressionStatement;
        method.expression = call(member({
            type: Syntax.Identifier,
            name: target,
            loc: method.loc
        }, method.kind === 'get' ? '__defineGetter__' : '__defineSetter__'), [
            method.key.type === Syntax.Identifier ? raw(JSON.stringify(method.key.name)) : method.key,
            method.value
        ])
    } else if (method.kind === 'constructor') {
        arr.hasConstructor = true;
        method.type = Syntax.FunctionDeclaration;
        method.id = arr.$className;
        method.params = method.value.params;
        method.body = method.value.body;
    } else {
        method.type = Syntax.ExpressionStatement;
        method.expression = assign({
            type: Syntax.MemberExpression,
            object: {type: Syntax.Identifier, name: target, loc: method.loc},
            property: method.key,
            computed: method.computed
        }, method.value);
    }
}

function saveScope() {
    const oldCtx = context;
    context = {__proto__: context};
    return oldCtx;
}

function onStmt(stmt, i, arr) {
    for (; stmt;) switch (stmt.type) {
        case Syntax.BlockStatement:
        {
            const oldCtx = saveScope();
            stmt.body.forEach(onStmt);
            context = oldCtx;
            return;
        }
        case Syntax.ExpressionStatement:
            onExpr(stmt.expression);
            return;
        case Syntax.IfStatement:
            onExpr(stmt.test);
            onStmt(stmt.consequent);
            stmt = stmt.alternate;
            continue;
        case Syntax.ReturnStatement:
        case Syntax.ThrowStatement:
            onExpr(stmt.argument);
        case Syntax.EmptyStatement:
        case Syntax.BreakStatement:
        case Syntax.ContinueStatement:
        case Syntax.DebuggerStatement:
            return;
        case Syntax.TryStatement:
            onStmt(stmt.block);
            if (stmt.handler) {
                const oldCtx = saveScope();
                context[stmt.handler.param.name] = {kind: 'var'};
                stmt.handler.body.body.forEach(onStmt);
                context = oldCtx;
            }
            stmt = stmt.finalizer;
            continue;
        case Syntax.WhileStatement:
            onExpr(stmt.test);
            stmt = stmt.body;
            continue;
        case Syntax.DoWhileStatement:
            onStmt(stmt.body);
            onExpr(stmt.test);
            return;
        case Syntax.ForStatement:
            stmt.init && (stmt.init.type === Syntax.VariableDeclaration ? onStmt : onExpr)(stmt.init);
            onExpr(stmt.test);
            onExpr(stmt.update);
            stmt = stmt.body;
            continue;
        case Syntax.ForOfStatement:
        case Syntax.ForInStatement:
        {
            const isFor = stmt.type === Syntax.ForStatement,
                init = isFor ? stmt.init : stmt.left,
                hasDecl = init && init.type === Syntax.VariableDeclaration;
            let body = stmt.body, hasBlockBody = body.type === Syntax.BlockStatement;


            if (hasDecl && !hasBlockBody) {
                body = stmt.body = {
                    type: Syntax.BlockStatement,
                    body: [body]
                };
                hasBlockBody = true;
            }
            const oldCtx = hasBlockBody ? saveScope() : null;

            if (hasDecl) {
                const kind = init.kind, decl = init.declarations[0], $id = decl.id;
                if ($id.type === Syntax.Identifier) {
                    context[$id.name] = init;
                } else { // destruct
                    init.kind = 'let';
                    const temp = decl.id = id('$ftemp' + $id.loc.start.line + '_' + $id.loc.start.column);
                    const decls = [];
                    handleDestruct($id, temp, function (decl, init) {
                        context[decl.name] = init;
                        decls.push(declarator(decl, init));
                    });
                    if (decls.length) {
                        body.body.unshift({type: Syntax.VariableDeclaration, kind: kind, declarations: decls});
                    }
                }
            } else {
                onExpr(stmt.left);
            }

            if (isFor) {
                onExpr(stmt.test);
                onExpr(stmt.update);
            } else {
                onExpr(stmt.right);
            }
            if (hasBlockBody) {
                body.body.forEach(onStmt);
                context = oldCtx;
                return
            } else {
                stmt = body;
                continue;
            }
        }
        case Syntax.VariableDeclaration:
        {
            for (let i = 0, decls = stmt.declarations, L = decls.length; i < L; i++) {
                let decl = decls[i], id = decl.id;
                onExpr(decl.init);
                if (id.type === Syntax.Identifier) {
                    context[id.name] = stmt;
                } else {
                    const start = i;
                    decls.splice(i--, 1); // delete this decl
                    let destructed = 0;
                    let variable = handleDestruct(id, decl.init, function (identifier, init) {
                        destructed++;
                        decls.splice(++i, 0, declarator(identifier, init));
                    });
                    if (variable.name === '$ptemp') { // has rename
                        let curr = decls[start].init, expr;
                        do {
                            expr = curr;
                            curr = curr.object;
                        } while (curr.type === Syntax.MemberExpression);
                        expr.object = i > start ? assign(variable, decl.init) : decl.init;
                    }
                }
            }

            return;
        }
        case Syntax.ClassDeclaration:
            onClass(stmt);
            return;
        case Syntax.FunctionDeclaration:
            context[stmt.id.name] = {kind: 'var'};
            onFunction(stmt);
            return;
        case Syntax.ExportNamedDeclaration:
            if (stmt.declaration) {
                stmt = arr[i] = stmt.declaration;
                if (stmt.type === Syntax.FunctionDeclaration || stmt.type === Syntax.ClassDeclaration) {
                    exportedNames[stmt.id.name] = {name: stmt.id.name, found: true};
                } else if (stmt.type === Syntax.VariableDeclaration) {
                    for (let decl of stmt.declarations) {
                        exportedNames[decl.id.name] = {name: decl.id.name, found: true};
                    }
                }
                continue; // tail call optimization
            } else {
                for (let spec of stmt.specifiers) {
                    let localName = spec.local.name;
                    exportedNames[spec.exported.name] = {name: localName, found: localName in context};
                }
                arr[i] = null;
            }
            return;
        case Syntax.ExportDefaultDeclaration:
        {
            hasDefault = true;
            const decl = stmt.declaration;
            let isExpr = true, stmtId = null;
            if (decl.type === Syntax.ClassDeclaration || decl.type === Syntax.FunctionDeclaration) {
                stmtId = decl.id;
                if (!stmtId) {
                    decl.type = decl.type === Syntax.ClassDeclaration ? Syntax.ClassExpression : Syntax.FunctionExpression;
                } else {
                    isExpr = false
                }
            }
            if (isExpr) {
                onExpr(decl);

                stmt.type = Syntax.ExpressionStatement;
                stmt.expression = call({
                    type: Syntax.Identifier,
                    name: 'Object.defineProperty',
                    loc: stmt.loc
                }, [id('module'), id('moduleDefault'), {
                    type: Syntax.ObjectExpression,
                    properties: [prop('value', stmt.declaration)]
                }]);
                return;
            } else {
                arr.push(expr(call(id('Object.defineProperty'), [id('module'), id('moduleDefault'), {
                    type: Syntax.ObjectExpression,
                    properties: [prop('value', stmtId)]
                }])));
                arr[i] = decl;
                stmt = decl;
                continue;
            }
        }
        case Syntax.ImportDeclaration:
        {
            const callStmt = call({type: Syntax.Literal, raw: 'include', loc: stmt.loc}, [raw(stmt.source.raw)]);
            if (!stmt.specifiers.length) {
                stmt.type = Syntax.ExpressionStatement;
                stmt.expression = call(member({
                    type: Syntax.MemberExpression,
                    object: callStmt,
                    property: id('loadProgress'),
                    computed: true
                }, 'done'), []);
                return;
            }
            let imported = {type: Syntax.Identifier};
            for (let spec of stmt.specifiers) {
                if (spec.type === Syntax.ImportNamespaceSpecifier) {
                    imported.name = spec.local.name;
                    context[imported.name] = {kind: 'const'};
                } else {
                    const isDefault = spec.type === Syntax.ImportDefaultSpecifier;
                    context[spec.local.name] = {
                        kind: 'imported',
                        imported: imported,
                        name: isDefault ? {
                            type: Syntax.Identifier,
                            name: 'moduleDefault',
                            computed: true
                        } : spec.imported,
                        computed: isDefault
                    };
                }
            }
            if (!imported.name) imported.name = '$' + stmt.source.value.replace(/\W+/g, '_') + '_' + stmt.loc.start.line;
            //console.log(stmt.specifiers);

            stmt.type = Syntax.VariableDeclaration;
            stmt.kind = 'const';
            stmt.declarations = [declarator(imported, callStmt)];

            return;
        }
        case Syntax.SwitchStatement:
            onExpr(stmt.discriminant);
            stmt.cases.forEach(onSwitchCase);
            return;
        case Syntax.LabeledStatement:
            stmt = stmt.body;
            continue;
        default:
            console.error('on statement', stmt);
            throw new Error('unhandled statement ' + stmt.type);
    }
}

function onSwitchCase(switchCase) {
    onExpr(switchCase.test);
    switchCase.consequent.forEach(onStmt);
}

function handleDestruct(left, right, cb) {
    let variable = {type: Syntax.Identifier, loc: left.loc};
    if (right.type === Syntax.Identifier) {
        variable.name = right.name;
    } else {
        hasDestruct = true;
        variable.name = '$ptemp';
    }
    walk(left, variable);
    return variable;

    function walk(pattern, variable) {
        switch (pattern.type) {
            case Syntax.ObjectPattern:
                for (let prop of pattern.properties) walk(prop.value, {
                    type: Syntax.MemberExpression,
                    object: variable,
                    property: prop.key,
                    computed: prop.computed || prop.key.type !== Syntax.Identifier
                });
                break;
            case Syntax.ArrayPattern:
                pattern.elements.forEach(function (elem, i) {
                    elem && walk(elem, {
                        type: Syntax.MemberExpression,
                        object: variable,
                        property: raw(i + ''),
                        computed: true
                    });
                });
                break;
            case Syntax.AssignmentPattern:
                cb(pattern.left, variableDefault(variable, pattern.right));
                break;
            case Syntax.RestElement:
                cb(pattern.argument, call(id('Array.prototype.slice.call'), [variable.object, variable.property]));
                break;
            default:
                cb(pattern, variable);
                break;
        }
    }
}

function variableDefault(variable, defaults) {
    hasDestruct = true;

    return binary({
        type: Syntax.AssignmentExpression,
        left: $dtemp,
        operator: '=',
        right: variable
    }, '||', {
        type: Syntax.ConditionalExpression,
        test: binary({
            type: Syntax.UnaryExpression,
            operator: 'typeof',
            prefix: true,
            argument: $dtemp
        }, '===', raw('"undefined"')),
        consequent: defaults,
        alternate: $dtemp
    });
    //return {
    //    type: Syntax.ConditionalExpression,
    //    test: binary({
    //        type: Syntax.UnaryExpression,
    //        operator: 'typeof',
    //        prefix: true,
    //        argument: {
    //            type: Syntax.AssignmentExpression,
    //            left: $dtemp,
    //            operator: '=',
    //            right: variable
    //        }
    //    }, '===', raw('"undefined"')),
    //    consequent: defaults,
    //    alternate: $dtemp
    //}
}

function onExpr(expr) {
    for (; expr;) switch (expr.type) {
        case Syntax.Literal:
        case Syntax.ThisExpression:
            return;
        case Syntax.Identifier:
        {
            let variable = context[expr.name];
            if (variable && variable.kind === 'imported') {
                expr.type = Syntax.MemberExpression;
                expr.object = {type: Syntax.Identifier, name: variable.imported.name, loc: expr.loc};
                expr.property = variable.name;
                expr.computed = variable.computed;
            }
            return;
        }
        case Syntax.UpdateExpression:
        case Syntax.UnaryExpression:
        case Syntax.YieldExpression:
            expr = expr.argument;
            continue;
        case Syntax.CallExpression:
        {
            expr['arguments'].forEach(onExpr);
            const callee = expr.callee;
            if (handleClass) {
                if (callee.type === Syntax.Super) { // super()
                    expr.callee = member({
                        type: Syntax.Identifier,
                        name: 'super_proto',
                        loc: callee.loc
                    }, 'constructor.call');
                    expr['arguments'].unshift($this);
                    return
                }
                if (callee.type === Syntax.MemberExpression && callee.object.type === Syntax.Super) {
                    // super.xxx()
                    callee.object = {type: Syntax.Identifier, name: 'super_proto', loc: callee.object.loc};
                    expr.callee = member(callee, 'call');
                    expr['arguments'].unshift($this);
                }
            }

            expr = expr.callee;
            continue;
        }
        case Syntax.NewExpression:
            onExpr(expr.callee);
            expr['arguments'].forEach(onExpr);
            return;
        case Syntax.MemberExpression:
            onExpr(expr.object);
            if (expr.computed) {
                expr = expr.property;
                continue;
            } else {
                return;
            }
        case Syntax.AssignmentExpression:
            if (expr.left.type === Syntax.ObjectPattern || expr.left.type === Syntax.ArrayPattern) {
                onExpr(expr.right);

                expr.type = Syntax.SequenceExpression;
                const expressions = expr.expressions = [];
                let variable = handleDestruct(expr.left, expr.right, function (left, right) {
                    onExpr(left);
                    expressions.push(assign(left, right));
                });
                variable.name === '$ptemp' && expressions.unshift(assign(variable, expr.right));
                expressions.push(variable);
                return;
            }
        case Syntax.LogicalExpression:
        case Syntax.BinaryExpression:
            onExpr(expr.left);
            expr = expr.right;
            continue;
        case Syntax.ConditionalExpression:
            onExpr(expr.test);
            onExpr(expr.consequent);
            expr = expr.alternate;
            continue;
        case Syntax.ClassExpression:
            onClass(expr);
            return;
        case Syntax.FunctionExpression:
            onFunction(expr);
            return;
        case Syntax.Super:
            if (handleClass) {
                expr.type = Syntax.Identifier;
                expr.name = 'super_proto';
            }
            return;
        case Syntax.TemplateLiteral:
        {
            const exprs = expr.expressions;
            let i = exprs.length;
            exprs.forEach(onExpr);
            if (!handleStringTemplate) return;
            if (i === 0) { // `simple string`
                expr.type = Syntax.Literal;
                expr.raw = JSON.stringify(expr.quasis[0].value.cooked);
                return;
            }

            expr.type = Syntax.BinaryExpression;
            expr.operator = '+';
            let current = expr, last = expr.quasis[i].value;

            while (i--) {
                let str = expr.quasis[i].value;
                str.type = Syntax.Literal;
                str.raw = JSON.stringify(str.cooked);

                current = current.left = binary(binary(null, '+', str), '+', exprs[i]);
                current = current.left;
            }
            if (last.cooked) {
                expr.right = last;
                last.type = Syntax.Literal;
                last.raw = JSON.stringify(last.cooked);
            } else {
                expr.right = expr.left.right;
                expr.left = expr.left.left;
            }
            current.type = Syntax.Literal;
            current.raw = current.right.raw;
            current.loc = current.right.loc;
            return;
        }
        case Syntax.ArrayExpression:
            expr.elements.forEach(onExpr);
            return;
        case Syntax.ObjectExpression:
            expr.properties.forEach(function (prop) {
                onExpr(prop.value)
            });
            return;
        case Syntax.ArrowFunctionExpression:
            onFunction(expr);
            return;
        case Syntax.SequenceExpression:
            expr.expressions.forEach(onExpr);
            return;
        default:
            console.error('on expression', expr);
            throw new Error('unhandled expression ' + expr.type);
    }
}

function onFunction(node) {
    const body = node.body, params = node.params;

    const isArrow = node.type === Syntax.ArrowFunctionExpression,
        isBlock = !isArrow || body.type === Syntax.BlockStatement;

    const stmts = isBlock ? body.body : [];
    const oldCtx = saveScope(), oldDestruct = hasDestruct;
    hasDestruct = false;
    let L = node.params.length;
    const hasRest = L && node.params[L - 1].type === Syntax.RestElement;
    hasRest && L--;


    const paramType = {kind: 'var'};
    let startOfStmts = 0, extraDecls = [], nonDefault = L;
    for (let i = 0; i < L; i++) {
        let p = node.params[i], d = node.defaults[i], hasDestruct;

        if (p.type !== Syntax.Identifier) {
            hasDestruct = p;
            p = node.params[i] = id('$ptemp' + i);
        }

        if (d) {
            if (isArrow) {
                extraDecls.push(declarator(p, variableDefault(p, d)))
            } else {
                if (nonDefault > i) nonDefault = i;
                extraDecls.push(declarator(p, variableDefault({
                    type: Syntax.MemberExpression,
                    object: id('arguments'),
                    property: raw(i + ''),
                    computed: true
                }, d)))
            }
        }
        if (hasDestruct) {
            handleDestruct(hasDestruct, p, function (identifier, init) {
                extraDecls.push(declarator(identifier, init));
            });
        } else {
            context[p.name] = paramType;
        }
    }
    if (!isBlock && (stmts.length || extraDecls.length || hasRest && handleRest)) {
        stmts.push({
            type: Syntax.ReturnStatement,
            argument: node.body
        });
        stmts.forEach(onStmt);
        node.body = {
            type: Syntax.BlockStatement,
            body: stmts
        };
    } else if (isBlock) {
        stmts.forEach(onStmt);
    } else {
        onExpr(node.body);
    }

    extraDecls.length && stmts.splice(startOfStmts, 0, {
        type: Syntax.VariableDeclaration,
        kind: 'var',
        declarations: extraDecls
    });

    if (hasRest) {
        if (handleRest || nonDefault < L) {
            stmts.unshift({
                type: Syntax.VariableDeclaration,
                kind: 'const',
                declarations: [declarator(node.params[L].argument, call(id('Array.prototype.slice.call'), [id('arguments'), raw(L + '')]))]
            });
            node.params.length = nonDefault;
        } else {
            context[node.params[L].argument.name] = paramType
        }
    }
    if (nonDefault < L) {
        node.params.length = nonDefault;
    }
    hasDestruct && stmts.push($ptemp);

    context = oldCtx;
    hasDestruct = oldDestruct;
}

function onClass(node) {
    const isStmt = node.type === Syntax.ClassDeclaration;
    //console.log(stmt);
    node.superClass && onExpr(node.superClass);

    const body = node.body.body;

    const className = node.id ? node.id.name : 'anonymous', $className = body.$className = id(className);
    isStmt && (context[className] = {kind: 'var'});
    body.forEach(onMethod);
    if (!handleClass) {
        return;
    }

    body.unshift({
        type: Syntax.VariableDeclaration,
        kind: 'const',
        declarations: [declarator($proto, member($className, 'prototype'))]
    });

    if (node.superClass) {
        body[0].declarations.push(declarator($super_proto, assign(member($proto, '__proto__'), member(node.superClass, 'prototype'))))
    }

    body.push({type: Syntax.ReturnStatement, argument: $className});
    if (!body.hasConstructor) {
        body.push({
            type: Syntax.FunctionDeclaration,
            id: $className,
            params: [],
            body: {
                type: Syntax.BlockStatement,
                body: node.superClass ? [expr(call(member($super_proto, 'constructor.call'), [$this]))] : []
            }
        })
    }

    const factory = {
        type: Syntax.FunctionExpression,
        params: [],
        body: {
            loc: node.body.loc,
            type: Syntax.BlockStatement,
            body: body
        }
    };
    if (isStmt) {
        node.type = Syntax.VariableDeclaration;
        node.kind = 'var';
        node.declarations = [declarator(node.id, call(factory, []))];
    } else {
        node.type = Syntax.CallExpression;
        node.callee = factory;
        node['arguments'] = [];
    }

}