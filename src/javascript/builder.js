"use strict";

const Syntax = require('./esprima').Syntax;
const whitespaces = ' '.repeat(128);

let line = 1, column = 0, buf = '', toIndent = null;


function returns() {
    const ret = buf;
    line = 1;
    column = 0;
    buf = '';
    toIndent = null;
    return ret;
}

module.exports = function (ast) {
    //console.log('building', ast);
    // assert ast.type === Syntax.Program
    ast.body.forEach(onStmt);

    return returns();
};

function onStmt(stmt) {
    for (; ;) {
        switch (stmt.type) {
            case Syntax.BlockStatement:
                appendStart('{', stmt);
                stmt.body.forEach(onStmt);
                appendEnd('}', stmt);
                return;
            case Syntax.ExpressionStatement:
                onExpr(stmt.expression, true);
                break;
            case Syntax.IfStatement:
                appendStart('if (', stmt);
                onExpr(stmt.test);
                append(') ');
                onStmt(stmt.consequent);
                if (stmt.alternate) {
                    append(' else ');
                    stmt = stmt.alternate;
                    continue;
                }
                return;
            case Syntax.VariableDeclaration:
                appendStart(stmt.kind + ' ', stmt);
                stmt.declarations.forEach(onVarDecl);
                break;
            case Syntax.ReturnStatement:
                appendStart('return', stmt);
                if (stmt.argument) {
                    append(' ');
                    onExpr(stmt.argument);
                }
                break;
            case Syntax.ThrowStatement:
                appendStart('throw ', stmt);
                onExpr(stmt.argument);
                break;
            case Syntax.FunctionDeclaration:
                onFunction(stmt);
                return;
            case Syntax.TryStatement:
                appendStart('try {', stmt);
                stmt.block.body.forEach(onStmt);
                if (stmt.handler) {
                    append('} catch (');
                    onIdentifier(stmt.handler.param);
                    append(') {');
                    stmt.handler.body.body.forEach(onStmt);
                }
                if (stmt.finalizer) {
                    append('} finally {');
                    stmt.finalizer.body.forEach(onStmt);
                }
                appendEnd('}', stmt);
                return;
            case Syntax.ForStatement:
                appendStart('for (', stmt);
                onDeclOrExpr(stmt.init);
                append('; ');
                onExpr(stmt.test);
                append('; ');
                onExpr(stmt.update);
                append(') ');
                stmt = stmt.body;
                continue;
            case Syntax.ForInStatement:
            case Syntax.ForOfStatement:
                appendStart('for (', stmt);
                onDeclOrExpr(stmt.left);
                append(stmt.type === Syntax.ForInStatement ? ' in ' : ' of ');
                onExpr(stmt.right);
                append(') ');
                stmt = stmt.body;
                continue;
            case Syntax.WhileStatement:
                appendStart('while (', stmt);
                onExpr(stmt.test);
                append(') ');
                stmt = stmt.body;
                continue;
            case Syntax.DoWhileStatement:
                appendStart('do ', stmt);
                onStmt(stmt.body);
                append(' while (');
                onExpr(stmt.test);
                appendEnd(');', stmt);
                return;
            case Syntax.EmptyStatement:
                appendStart(';', stmt);
                return;
            case Syntax.SwitchStatement:
                appendStart('switch (', stmt);
                onExpr(stmt.discriminant);
                append(') {');
                stmt.cases.forEach(onSwitchCase);
                appendEnd('}', stmt);
                return;
            case Syntax.BreakStatement:
            case Syntax.ContinueStatement:
            {
                let str = stmt.type === Syntax.BreakStatement ? 'break' : 'continue';
                if (stmt.label) {
                    str += ' ' + stmt.label.name + ';'
                } else {
                    str += ';'
                }
                appendStart(str, stmt);
                return;
            }
            case Syntax.LabeledStatement:
                onIdentifier(stmt.label);
                append(':');
                stmt = stmt.body;
                continue;
            default:
                console.log('on statement', stmt);
                throw new Error('unhandled statement type ' + stmt.type);
        }
        append(';');
        break;
    }
}

function onSwitchCase(switchCase) {
    if (switchCase.test) {
        appendStart('case ', switchCase);
        onExpr(switchCase.test);
        append(':')
    } else {
        appendStart('default:', switchCase);
    }
    switchCase.consequent.forEach(onStmt);
}

function onDeclOrExpr(node) {
    if (node && node.type === Syntax.VariableDeclaration) {
        appendStart(node.kind + ' ', node);
        node.declarations.forEach(onVarDecl);
    } else if (node) {
        onExpr(node);
    }
}

function onIdentifier(node) {
    appendStart(node.name, node);
}

function onVarDecl(decl, i) {
    i && append(', ');
    onIdentifier(decl.id);
    if (decl.init) {
        append(' = ');
        onExpr(decl.init);
    }
}

const levels = {
    '*': 2,
    '/': 2,
    '%': 2,
    '+': 3,
    '-': 3,
    '<<': 4,
    '>>': 4,
    '>>>': 4,
    '<': 5,
    '<=': 5,
    '>': 5,
    '>=': 5,
    'instanceof': 5,
    '==': 6,
    '!=': 6,
    '===': 6,
    '!==': 6,
    '&': 7,
    '^': 8,
    '|': 9, '&&': 10,
    '||': 11
};

function level(expr) {
    switch (expr.type) {
        case Syntax.ArrowFunctionExpression:
        case Syntax.UnaryExpression:
        case Syntax.NewExpression:
        case Syntax.UpdateExpression:
            return 1;
        case Syntax.BinaryExpression:
        case Syntax.LogicalExpression:
            return levels[expr.operator];
        case Syntax.ConditionalExpression:
            return 12;
        case Syntax.AssignmentExpression:
            return 13;
        case Syntax.YieldExpression:
            return 14;
        case Syntax.SequenceExpression:
            return 15;
        default:
            return 0;
    }
}

function autoWrap(expr, l) {
    const wrap = level(expr) > l;
    if (wrap) appendBefore('(', expr, 1);
    onExpr(expr);
    if (wrap) append(')');
}

function onExpr(expr, isStmt) {
    if (!expr) return;
    //console.log('on expression', expr);
    switch (expr.type) {
        case Syntax.Literal:
            appendStart(expr.raw, expr);
            break;
        case Syntax.UpdateExpression:
        case Syntax.UnaryExpression:
            if (expr.prefix) {
                appendStart(expr.operator + (expr.operator === 'typeof' || expr.operator === 'void' ? ' ' : ''), expr);
                onExpr(expr.argument);
            } else {
                onExpr(expr.argument);
                append(expr.operator);
            }
            break;
        case Syntax.BinaryExpression:
        case Syntax.LogicalExpression:
        case Syntax.AssignmentExpression:
        {
            const lvl = level(expr);
            autoWrap(expr.left, lvl);
            append(' ' + expr.operator + ' ');
            autoWrap(expr.right, lvl - 1);
            break;
        }
        case Syntax.ConditionalExpression:
            autoWrap(expr.test, 13);
            append(' ? ');
            autoWrap(expr.consequent, 12);
            append(' : ');
            autoWrap(expr.alternate, 12);
            break;
        case Syntax.MemberExpression:
        {
            const wrapObject = level(expr.object) > 0, isDot = !expr.computed && expr.property.type === Syntax.Identifier;
            if (wrapObject) append('(');
            onExpr(expr.object);
            append(wrapObject ? isDot ? ').' : ')[' : isDot ? '.' : '[');
            onExpr(expr.property);
            isDot || append(']');
            break;
        }
        case Syntax.CallExpression:
        {
            const callee = expr.callee;
            const requiresWrap = isStmt && callee.type === Syntax.FunctionExpression || level(callee) > 0;
            if (requiresWrap) {
                appendBefore('(', expr, 1);
            }
            onExpr(callee);
            append(requiresWrap ? ')(' : '(');
            onExprs(expr['arguments']);
            appendEnd(')', expr);
            break;
        }
        case Syntax.Identifier:
            onIdentifier(expr);
            break;
        case Syntax.ThisExpression:
            appendStart('this', expr);
            break;
        case Syntax.FunctionExpression:
            if (isStmt) {
                appendBefore('(', expr, 1);
            }
            onFunction(expr);
            if (isStmt) append(')');
            break;
        case Syntax.ObjectExpression:
            if (isStmt) {
                appendBefore('({', expr, 1);
            } else {
                appendStart('{', expr)
            }
            for (let i = 0, L = expr.properties.length; i < L; i++) {
                i && append(',');
                let prop = expr.properties[i];
                onExpr(prop.key); // identifier or literal
                append(':');
                onExpr(prop.value);
            }
            appendEnd(isStmt ? '})' : '}', expr);
            break;
        case Syntax.NewExpression:
        {
            appendStart('new ', expr);
            const calleeIsCall = expr.callee.type === Syntax.CallExpression;

            if (calleeIsCall) append('(');
            onExpr(expr.callee);
            append(calleeIsCall ? ')(' : '(');
            onExprs(expr['arguments']);
            append(')');
            break;
        }
        case Syntax.ArrayExpression:
        {
            appendStart('[', expr);
            onExprs(expr.elements);
            append(']');
            break;
        }
        case Syntax.ArrowFunctionExpression:
            onFunction(expr);
            break;
        case Syntax.SequenceExpression:
            onExprs(expr.expressions);
            break;
        case Syntax.YieldExpression:
        {
            const requiresWrap = level(expr.argument) > 14;
            appendStart((expr.delegate ? 'yield* ' : 'yield ') + (requiresWrap ? '(' : ''), expr);
            onExpr(expr.argument);
            requiresWrap && append(')');
            break;
        }

        default:
            console.log('on expression', expr);
            throw new Error('unhandled expression type ' + expr.type);
    }
}

function onExprs(arr) {
    if (!arr.length) return;
    for (let i = 0, L = arr.length; i < L; i++) {
        let expr = arr[i], lv = level(expr);
        append(lv === 15 ? i ? ', (' : '(' : i ? ', ' : '');
        onExpr(arr[i]);
        lv === 15 && append(')');
    }
}


function onFunction(expr) {
    const isArrow = expr.type === Syntax.ArrowFunctionExpression;
    appendStart(isArrow ? '' : expr.generator ? 'function* ' : 'function ', expr);
    expr.id && onIdentifier(expr.id);
    let L = expr.params.length;
    if (!isArrow || L !== 1) append('(');
    const hasRest = L && expr.params[L - 1].type === Syntax.RestElement;
    if (hasRest) L--;
    for (let i = 0; i < L; i++) {
        i && append(', ');
        onIdentifier(expr.params[i]);
    }
    if (hasRest) {
        appendStart(L ? ', ...' : '...');
        onIdentifier(expr.params[L].argument);
    }
    if (isArrow) {
        if (expr.body.type === Syntax.BlockStatement) {
            if (L === 1) {
                appendBefore(' => {', expr.body, 4);
            } else {
                appendBefore(') => {', expr.body, 5);
            }
            expr.body.body.forEach(onStmt);
            appendEnd('}', expr.body);
        } else {
            if (L === 1) {
                appendBefore(' => ', expr.body, 3);
            } else {
                appendBefore(') => ', expr.body, 4);
            }
            onExpr(expr.body);
        }
    } else {
        appendBefore(') {', expr.body, 2);
        expr.body.body.forEach(onStmt);
        appendEnd('}', expr.body);
    }
}

function appendBefore(str, node, i) {
    let loc = node.loc && node.loc.start;
    if (loc && loc.column >= i) {
        loc.column -= i;
    }
    append(str, loc);
}

function appendStart(str, node) {
    append(str, node.loc && node.loc.start);
}

function appendEnd(str, node) {
    let loc = node.loc && node.loc.end;
    if (loc && loc.column >= str.length) {
        loc.column -= str.length;
    }
    append(str, loc);
}

function append(str, pos) {
    const l = pos ? pos.line : 0, c = pos ? pos.column : 0;
    if (l < line || l === line && c <= column) { // freely
        buf += str;
    } else {
        if (l > line) {
            do {
                buf += '\n';
                line++;
            } while (l > line);
            column = 0;
        }
        if (c > column) {
            buf += whitespaces.substr(0, c - column);
            column = c;
        }
        buf += str;
    }
    column += str.length;
}