"use strict";
let handleStringTemplate, handleClass, handleRest;

const Syntax = require('./esprima').Syntax;

const params = ['module', 'co', 'require', 'include', '__filename', '__dirname', 'moduleDefault', 'loadProgress'].map(id),
    useStrict = expr(raw('"use strict"')),
    VariableType = {type: 'variable'},
    $proto = id('proto'),
    $super_proto = id('super_proto'),
    $pterm = {
        type: Syntax.VariableDeclaration,
        kind: 'var',
        declarations: [{
            type: Syntax.VariableDeclarator,
            id: id('$ptemp')
        }]
    }, $this = {type: Syntax.ThisExpression},
    $noDefault = expr({
        type: Syntax.CallExpression,
        callee: id('Object.defineProperty'),
        arguments: [id('module'), id('moduleDefault'), {
            type: Syntax.ObjectExpression,
            properties: [{
                type: Syntax.Property,
                key: id('value'),
                value: id('undefined')
            }]
        }]
    });

let context = {}, exportedNames = {}, hasDestruct = false, hasDefault = false;

function id(name) {
    return {type: Syntax.Identifier, name: name}
}

function raw(str) {
    return {type: Syntax.Literal, raw: str}
}

function expr(node) {
    return {type: Syntax.ExpressionStatement, expression: node}
}

function member(object, property) {
    return {
        type: Syntax.MemberExpression,
        object: object,
        property: id(property)
    }
}

function assign(left, right) {
    return {
        type: Syntax.AssignmentExpression,
        operator: '=',
        left: left,
        right: right
    };
}

function binary(operator, left, right) {
    return {
        type: Syntax.BinaryExpression,
        operator: operator,
        left: left,
        right: right
    };
}

module.exports = function (ast, options) {
    handleStringTemplate = options.StringTemplate;
    handleClass = options.Class;
    handleRest = options.Rest;

    let stmts = ast.body;
    stmts.forEach(onStmt);
    return returns(stmts);
};

function returns(stmts) {

    // handle exported
    const properties = [], exports = {};
    for (let key in exportedNames) {
        let val = exportedNames[key], name = val.name, varDecl = context[name], $name = id(name);
        if (!varDecl || (varDecl.kind === 'let' || varDecl.kind === 'const') && !val.found) throw new Error(name + ' not found in identifiers');
        let attrs;

        exports[key] = varDecl.kind;

        if (varDecl.kind === 'const') {
            attrs = [{
                type: Syntax.Property,
                key: id('value'),
                value: $name
            }]
        } else {
            attrs = [{
                type: Syntax.Property,
                key: id('get'),
                value: {
                    type: Syntax.FunctionExpression,
                    params: [],
                    body: {
                        type: Syntax.BlockStatement,
                        body: [{
                            type: Syntax.ReturnStatement,
                            argument: $name
                        }]
                    }
                }
            }, {
                type: Syntax.Property,
                key: id('set'),
                value: {
                    type: Syntax.FunctionExpression,
                    params: [id('_' + val.name)],
                    body: {
                        type: Syntax.BlockStatement,
                        body: [expr(assign($name, id('_' + name)))]
                    }
                }
            }]
        }
        properties.push({
            type: Syntax.Property,
            key: id(key),
            value: {
                type: Syntax.ObjectExpression,
                properties: attrs
            }
        })
    }

    properties.length && stmts.push(expr({
        type: Syntax.CallExpression,
        callee: id('Object.defineProperties'),
        arguments: [id('module'), {
            type: Syntax.ObjectExpression,
            properties: properties
        }]
    }));


    if (stmts[0] && stmts[0].type === Syntax.ExpressionStatement && stmts[0].expression.type === Syntax.Literal && stmts[0].expression.value === 'use strict') {
    } else {
        stmts.unshift(useStrict);
    }
    if (!hasDefault) {
        stmts.push($noDefault)
    }

    hasDestruct && stmts.push($pterm);
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

function onMethod(method, i, arr) {
    onExpr(method.value);
    if (!handleClass) {
        return;
    }
    let target = method.static ? arr.$className.name : 'proto';
    if (method.kind.length === 3) { // get|set
        method.type = Syntax.ExpressionStatement;
        method.expression = {
            type: Syntax.CallExpression,
            callee: member({
                type: Syntax.Identifier,
                name: target,
                loc: method.loc
            }, '__define' + method.kind[0].toUpperCase() + 'etter__'),
            arguments: [
                method.key.type === Syntax.Identifier ? raw(JSON.stringify(method.key.name)) : method.key,
                method.value
            ]
        }
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
            property: method.key
        }, method.value);
    }
}

function onDeclOrExpr(node) {
    if (node.type === Syntax.VariableDeclaration) {
        onStmt(node);
    } else {
        onExpr(node);
    }
}

function onStmt(stmt, i, arr) {
    for (; stmt;) switch (stmt.type) {
        case Syntax.BlockStatement:
        {
            let oldCtx = context;
            context = {__proto__: context};
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
            onStmt(stmt.alternate);
            return;
        case Syntax.ReturnStatement:
        case Syntax.ThrowStatement:
            onExpr(stmt.argument);
        case Syntax.EmptyStatement:
        case Syntax.BreakStatement:
        case Syntax.ContinueStatement:
            return;
        case Syntax.TryStatement:
            onStmt(stmt.block);
            if (stmt.handler) {
                const oldCtx = context;
                context = {__proto__: context};
                context[stmt.handler.param.name] = {kind: 'var'};
                stmt.handler.body.body.forEach(onStmt);
                context = oldCtx;
            }
            if (stmt.finalizer) onStmt(stmt.finalizer);
            return;
        case Syntax.WhileStatement:
            onExpr(stmt.test);
            stmt = stmt.body;
            continue;
        case Syntax.DoWhileStatement:
            onStmt(stmt.body);
            onExpr(stmt.test);
            return;
        case Syntax.ForStatement:
            onDeclOrExpr(stmt.init);
            onExpr(stmt.test);
            onExpr(stmt.update);
            stmt = stmt.body;
            continue;
        case Syntax.ForOfStatement:
        case Syntax.ForInStatement:
            onDeclOrExpr(stmt.left);
            onExpr(stmt.right);
            stmt = stmt.body;
            continue;
        case Syntax.VariableDeclaration:
        {
            for (let i = 0, decls = stmt.declarations, L = decls.length; i < L; i++) {
                let decl = decls[i], id = decl.id;
                onExpr(decl.init);
                if (id.type === Syntax.Identifier) {
                    context[id.name] = stmt;
                } else {
                    const start = i;
                    decls.splice(i, 1); // delete this decl
                    let variable = handleDestruct(id, decl.init, function (identifier, init) {
                        decls.splice(i++, 0, {
                            type: Syntax.VariableDeclarator,
                            id: identifier,
                            init: init
                        });
                    });
                    i--;
                    if (variable.name === '$ptemp') {
                        let curr = decls[start].init, expr;
                        while (curr.type === Syntax.MemberExpression) {
                            expr = curr;
                            curr = curr.object;
                        }
                        expr.object = assign(variable, decl.init);
                    }
                }
            }
            for (let decl of stmt.declarations) {

                if (decl.id.type === Syntax.Identifier) {
                    context[decl.id.name] = stmt;
                } else { // pattern
                    handleDestruct(decl.id, decl.init, function (identifier, init) {
                        context[identifier.name] = stmt;
                    });
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
                stmt.type = Syntax.EmptyStatement;
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
                stmt.expression = {
                    type: Syntax.CallExpression,
                    callee: id('Object.defineProperty'),
                    arguments: [id('module'), id('moduleDefault'), {
                        type: Syntax.ObjectExpression,
                        properties: [{
                            type: Syntax.Property,
                            key: id('value'),
                            value: stmt.declaration
                        }]
                    }]
                };
                return;
            } else {
                arr.push(expr({
                    type: Syntax.CallExpression,
                    callee: id('Object.defineProperty'),
                    arguments: [id('module'), id('moduleDefault'), {
                        type: Syntax.ObjectExpression,
                        properties: [{
                            type: Syntax.Property,
                            key: id('value'),
                            value: stmtId
                        }]
                    }]
                }));
                arr[i] = decl;
                stmt = decl;
                continue;
            }
        }
        case Syntax.ImportDeclaration:
        {
            const call = {
                type: Syntax.CallExpression,
                callee: {type: Syntax.Literal, raw: 'include', loc: stmt.loc},
                arguments: [raw(stmt.source.raw)]
            };
            if (!stmt.specifiers.length) {
                stmt.type = Syntax.ExpressionStatement;
                stmt.expression = {
                    type: Syntax.CallExpression,
                    callee: member({
                        type: Syntax.MemberExpression, object: call, property: id('loadProgress'),
                        computed: true
                    }, 'done'),
                    arguments: []
                };
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
            stmt.declarations = [{
                type: Syntax.VariableDeclarator,
                id: imported,
                init: call
            }];

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
            console.log(stmt);
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
                    computed: prop.key.type !== Syntax.Identifier
                }, cb);
                break;
            case Syntax.ArrayPattern:
                pattern.elements.forEach(function (elem, i) {
                    elem && walk(elem, {
                        type: Syntax.MemberExpression,
                        object: variable,
                        property: raw(i + ''),
                        computed: true
                    }, cb);
                });
                break;
            default:
                cb(pattern, variable);
                break;
        }
    }
}

function onExpr(expr) {
    if (!expr) return;
    switch (expr.type) {
        case Syntax.Literal:
        case Syntax.ThisExpression:
            break;
        case Syntax.Identifier:
        {
            let variable = context[expr.name];
            if (variable && variable.kind === 'imported') {
                expr.type = Syntax.MemberExpression;
                expr.object = {type: Syntax.Identifier, name: variable.imported.name, loc: expr.loc};
                expr.property = variable.name;
                expr.computed = variable.computed;
            }
            break;
        }
        case Syntax.UpdateExpression:
        case Syntax.UnaryExpression:
        case Syntax.YieldExpression:
            onExpr(expr.argument);
            break;
        case Syntax.CallExpression:
        {
            const callee = expr.callee;
            if (callee.type === Syntax.Super) { // super()
                expr.callee = member({
                    type: Syntax.Identifier,
                    name: 'super_proto',
                    loc: callee.loc
                }, 'constructor.call');
                expr['arguments'].unshift($this);
                break;
            } else if (callee.type === Syntax.MemberExpression && callee.object.type === Syntax.Super) {
                // super.xxx()
                callee.object = {type: Syntax.Identifier, name: 'super_proto', loc: callee.object.loc};
                expr.callee = member(callee, 'call');
                expr['arguments'].unshift($this);
            } else {
                onExpr(expr.callee);
            }
            expr['arguments'].forEach(onExpr);
            break;
        }
        case Syntax.NewExpression:
            onExpr(expr.callee);
            expr['arguments'].forEach(onExpr);
            break;
        case Syntax.MemberExpression:
            onExpr(expr.object);
            expr.computed && onExpr(expr.property);
            break;
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
                break;
            }
        case Syntax.LogicalExpression:
        case Syntax.BinaryExpression:
            onExpr(expr.left);
            onExpr(expr.right);
            break;
        case Syntax.ConditionalExpression:
            onExpr(expr.test);
            onExpr(expr.consequent);
            onExpr(expr.alternate);
            break;
        case Syntax.ClassExpression:
            onClass(expr);
            break;
        case Syntax.FunctionExpression:
            onFunction(expr);
            break;
        case Syntax.Super:
            expr.type = Syntax.Identifier;
            expr.name = 'super_proto';
            break;
        case Syntax.TemplateLiteral:
        {
            expr.expressions.forEach(onExpr);
            if (handleStringTemplate) {
                expr.type = Syntax.BinaryExpression;
                expr.operator = '+';
                let current = expr;

                for (let i = expr.expressions.length; i--;) {
                    let str = expr.quasis[i];
                    str.type = Syntax.Literal;
                    str.raw = JSON.stringify(str.value.cooked);

                    current = current.left = binary('+', binary('+', null, str), expr.expressions[i]);
                    current = current.left;
                }
                let last = expr.right = expr.quasis[expr.quasis.length - 1];
                last.type = Syntax.Literal;
                last.raw = JSON.stringify(last.value.cooked);
                current.type = Syntax.Literal;
                current.raw = current.right.raw;
                current.loc = current.right.loc;
            }
            break;
        }
        case Syntax.ArrayExpression:
            expr.elements.forEach(onExpr);
            break;
        case Syntax.ObjectExpression:
            expr.properties.forEach(onProp);
            break;
        case Syntax.ArrowFunctionExpression:
            onFunction(expr);
            break;
        case Syntax.SequenceExpression:
            expr.expressions.forEach(onExpr);
            break;
        default:
            console.log(expr);
            throw new Error('unhandled expression ' + expr.type);
    }
}

function onProp(prop) {
    onExpr(prop.value);
}

function onFunction(node) {
    let isBlock = node.body.type === Syntax.BlockStatement;

    const stmts = isBlock ? node.body.body : [];
    let oldCtx = context, oldDestruct = hasDestruct;
    context = {__proto__: oldCtx};
    hasDestruct = false;
    let L = node.params.length;
    const hasRest = L && node.params[L - 1].type === Syntax.RestElement;
    hasRest && L--;


    const paramType = {kind: 'var'};
    let startOfStmts = 0, extraDecls = [];
    for (let i = 0; i < L; i++) {
        let p = node.params[i], d = node.defaults[i];
        if (p.type === Syntax.Identifier) {
            context[p.name] = paramType;
        } else {
            const $temp = node.params[i] = id('$ptemp' + i);
            handleDestruct(p, $temp, function (identifier, init) {
                extraDecls.push({
                    type: Syntax.VariableDeclarator,
                    id: identifier,
                    init: init
                });
            });
            p = $temp;
        }
        d && stmts.splice(startOfStmts++, 0, expr(binary('&&', binary('===', {
            type: Syntax.UnaryExpression,
            operator: 'typeof',
            prefix: true,
            argument: p
        }, raw('"undefined"')), assign(p, d))))
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
        if (handleRest) {
            stmts.unshift({
                type: Syntax.VariableDeclaration,
                kind: 'const',
                declarations: [{
                    type: Syntax.VariableDeclarator,
                    id: node.params[L].argument,
                    init: {
                        type: Syntax.CallExpression,
                        callee: id('Array.prototype.slice.call'),
                        arguments: [id('arguments'), raw(L + '')]
                    }
                }]
            });
            node.params.length = L;
        } else {
            context[node.params[L].argument.name] = paramType
        }
    }
    hasDestruct && stmts.push($pterm);

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
        declarations: [{
            type: Syntax.VariableDeclarator,
            id: $proto,
            init: member($className, 'prototype')
        }, {
            type: Syntax.VariableDeclarator,
            id: $super_proto,
            init: assign(member($proto, '__proto__'), member(node.superClass || id('Object'), 'prototype'))
        }]
    }, expr(assign(member($proto, 'constructor'), $className)));
    body.push({type: Syntax.ReturnStatement, argument: $className});
    if (!body.hasConstructor) {
        body.push({
            type: Syntax.FunctionDeclaration,
            id: $className,
            params: [],
            body: {
                type: Syntax.BlockStatement,
                body: [expr({
                    type: Syntax.CallExpression,
                    callee: member($super_proto, 'constructor.call'),
                    arguments: [$this]
                })]
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
        node.declarations = [{
            type: Syntax.VariableDeclarator,
            id: node.id,
            init: {
                type: Syntax.CallExpression,
                callee: factory,
                arguments: []
            }
        }];
    } else {
        node.type = Syntax.CallExpression;
        node.callee = factory;
        node['arguments'] = [];
    }

}