"use strict";

const Syntax = require('./esprima').Syntax;
const newlines = '\n'.repeat(128), whitespaces = ' '.repeat(128);

let line = 1, column = 0, buf = '', toIndent = null;
const inspect = require('util').inspect;


function returns() {
    const ret = buf;
    line = 1;
    column = 0;
    buf = '';
    toIndent = null;
    return ret;
}

const $appendBefore = appendBefore, $appendStart = appendStart, $appendEnd = appendEnd;
let useLoc = true;

module.exports = function (ast, option) {
    //console.log('building', ast);
    // assert ast.type === Syntax.Program
    const _useLoc = option && option.loc;
    if (_useLoc !== useLoc) {
        if (_useLoc) {
            appendBefore = $appendBefore;
            appendStart = $appendStart;
            appendEnd = $appendEnd;
        } else {
            appendBefore = appendStart = appendEnd = append;
        }
        useLoc = _useLoc;
    }

    ast.body.forEach(onStmt);

    return returns();
};

function onStmt(stmt) {
    for (; stmt;) {
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
            case Syntax.ClassDeclaration:
                onClass(stmt);
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
            case Syntax.DebuggerStatement:
                appendStart('debugger', stmt);
                break;
            default:
                console.error('on statement ' + inspect(stmt, {depth: 10}));
                throw new Error('unhandled statement type ' + stmt.type);
        }
        append(';');
        return
    }
}

function onClass(node) {
    appendStart('class ', node);
    node.id && onIdentifier(node.id);
    if (node.superClass) {
        append(' extends ');
        onExpr(node.superClass);
    }
    appendBefore(' {', node.body, 2);
    node.body.body.forEach(onMethod);
    appendEnd('}', node);
}

function onMethod(method) {
    let prefix = '';
    if (method.static) prefix = 'static ';

    if (method.kind.length === 3) prefix += method.kind + ' '; // get|set

    if (method.computed) prefix += '[';

    appendStart(prefix, method);
    onExpr(method.key);
    if (method.computed) append(']');
    onFunction(method.value, true);
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
    onExpr(decl.id);
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
    'in': 5,
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
        case Syntax.UnaryExpression:
        case Syntax.NewExpression:
        case Syntax.UpdateExpression:
            return 1;
        case Syntax.BinaryExpression:
        case Syntax.LogicalExpression:
            return levels[expr.operator];
        case Syntax.ConditionalExpression:
            return 12;
        case Syntax.ArrowFunctionExpression:
        case Syntax.AssignmentExpression:
        case Syntax.AssignmentPattern:
            return 13;
        case Syntax.YieldExpression:
            return 14;
        case Syntax.SequenceExpression:
            return 15;
        default:
            return 0;
    }
}

function autoWrap(expr, l, isStmt) {
    const wrap = level(expr) > l;
    if (wrap) appendBefore('(', expr, 1);
    onExpr(expr, isStmt && !wrap);
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
                appendStart(expr.operator + (expr.operator.length > 3 ? ' ' : ''), expr);
                autoWrap(expr.argument, 1);
            } else {
                autoWrap(expr.argument, 1, isStmt);
                append(expr.operator);
            }
            break;
        case Syntax.AssignmentPattern:
            onIdentifier(expr.left);
            append(' = ');
            autoWrap(expr.right, 13);
            break;
        case Syntax.AssignmentExpression:
            if (isStmt && expr.left.type === Syntax.ObjectPattern) {
                append('(');
                onExpr(expr.left);
                append(' = ');
                autoWrap(expr.right, 13);
                append(')');
                break;
            }
        case Syntax.BinaryExpression:
        case Syntax.LogicalExpression:
        {
            const lvl = level(expr);
            autoWrap(expr.left, lvl, isStmt);
            append(' ' + expr.operator + ' ');
            autoWrap(expr.right, expr.type === Syntax.AssignmentExpression ? 13 : lvl - 1);
            break;
        }
        case Syntax.ConditionalExpression:
            autoWrap(expr.test, 12);
            append(' ? ');
            autoWrap(expr.consequent, 12);
            append(' : ');
            autoWrap(expr.alternate, 12);
            break;
        case Syntax.MemberExpression:
            autoWrap(expr.object, expr.object.type === Syntax.NewExpression ? 1 : 0, isStmt);
            append(expr.computed ? '[' : '.');
            onExpr(expr.property);
            expr.computed && append(']');
            break;
        case Syntax.CallExpression:
            autoWrap(expr.callee, 0, isStmt);
            append('(');
            onExprs(expr['arguments']);
            appendEnd(')', expr);
            break;
        case Syntax.Identifier:
            onIdentifier(expr);
            break;
        case Syntax.ThisExpression:
            appendStart('this', expr);
            break;
        case Syntax.FunctionExpression:
            isStmt && appendBefore('(', expr, 1);
            onFunction(expr);
            isStmt && append(')');
            break;
        case Syntax.ClassExpression:
            onClass(expr);
            break;
        case Syntax.ObjectExpression:
        case Syntax.ObjectPattern:
            if (isStmt) {
                appendBefore('({', expr, 1);
            } else {
                appendStart('{', expr)
            }
            for (let i = 0, L = expr.properties.length; i < L; i++) {
                i && append(',');
                let prop = expr.properties[i];
                if (prop.computed) append('[');
                onExpr(prop.key); // identifier or literal
                if (prop.computed) append(']');
                if (prop.value.type === Syntax.AssignmentPattern) {
                    append('=');
                    onExpr(prop.value.right)
                } else {
                    append(':')
                    onExpr(prop.value);
                }
            }
            appendEnd(isStmt ? '})' : '}', expr);
            break;
        case Syntax.NewExpression:
        {
            appendStart('new ', expr);

            let curr = expr.callee, wrapCallee = false;
            for (; ;) {
                if (curr.type === Syntax.CallExpression || level(curr) > 0) {
                    wrapCallee = true;
                    break;
                }
                if (curr.type === Syntax.MemberExpression) {
                    curr = curr.object;
                    continue;
                }
                break;
            }

            if (wrapCallee) append('(');
            onExpr(expr.callee);
            append(wrapCallee ? ')(' : '(');
            onExprs(expr['arguments']);
            append(')');
            break;
        }
        case Syntax.RestElement:
            appendBefore('...', expr.argument, 3);
            onExpr(expr.argument);
            break;
        case Syntax.ArrayExpression:
        case Syntax.ArrayPattern:
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
            onExprs(expr.expressions, isStmt);
            break;
        case Syntax.YieldExpression:
        {
            const requiresWrap = level(expr.argument) > 14;
            appendStart((expr.delegate ? 'yield* ' : 'yield ') + (requiresWrap ? '(' : ''), expr);
            onExpr(expr.argument);
            requiresWrap && append(')');
            break;
        }
        case Syntax.Super:
            append('super', expr);
            break;
        case Syntax.TemplateLiteral:
        {
            appendStart('`', expr);
            const exprs = expr.expressions,
                quasis = expr.quasis,
                L = exprs.length;
            for (let i = 0; i < L; i++) {
                append(quasis[i].value.raw + '${');
                onExpr(exprs[i]);
                append('}')
            }
            append(quasis[L].value.raw + '`');
            break;
        }
        default:
            console.log('on expression', expr);
            throw new Error('unhandled expression type ' + expr.type);
    }
}

function onExprs(arr, isStmt) {
    if (!arr.length) return;
    for (let i = 0, L = arr.length; i < L; i++) {
        let expr = arr[i];
        if (!expr) {
            append(', ');
            continue
        }
        let isSeq = level(expr) === 15;
        append(isSeq ? i ? ', (' : '(' : i ? ', ' : '');
        onExpr(arr[i], isStmt && i === 0);
        isSeq && append(')');
    }
}


function onFunction(expr, isShorthand) {
    const isArrow = expr.type === Syntax.ArrowFunctionExpression;
    appendStart(isArrow || isShorthand ? '' : expr.generator ? 'function* ' : 'function ', expr);
    expr.id && onIdentifier(expr.id);
    let L = expr.params.length;
    append('(');
    const hasRest = L && expr.params[L - 1].type === Syntax.RestElement;
    if (hasRest) L--;
    const defaults = expr.defaults || [];
    for (let i = 0; i < L; i++) {
        i && append(', ');
        onExpr(expr.params[i]);
        if (defaults[i]) {
            append(' = ');
            autoWrap(defaults[i], 13)
        }
    }
    if (hasRest) {
        append(L ? ', ...' : '...');
        onIdentifier(expr.params[L].argument);
        L++;
    }
    if (isArrow) {
        if (expr.body.type === Syntax.BlockStatement) {
            appendBefore(') => {', expr.body, 5);
            expr.body.body.forEach(onStmt);
            appendEnd('}', expr.body);
        } else {
            let prefix = ') => ';
            const isObject = expr.body.type === Syntax.ObjectExpression;
            if (isObject) prefix += '(';

            appendBefore(prefix, expr.body, prefix.length);
            onExpr(expr.body);
            isObject && append(')');
        }
    } else {
        appendBefore(') {', expr.body, 2);
        expr.body.body.forEach(onStmt);
        appendEnd('}', expr.body);
    }
}

function appendBefore(str, node, i) {
    let loc = node.loc && node.loc.start;
    if (loc) {
        if (loc.column >= i)loc.column -= i;
        autoAppend(str, loc);
    } else {
        append(str);
    }
}

function appendStart(str, node) {
    let loc = node.loc && node.loc.start;
    if (loc) {
        autoAppend(str, loc);
    } else {
        append(str);
    }
}

function appendEnd(str, node) {
    let loc = node.loc && node.loc.end;
    if (loc) {
        if (loc.column >= str.length) loc.column -= str.length;
        autoAppend(str, loc);
    } else {
        append(str);
    }
}

function autoAppend(str, pos) {
    const l = pos.line, c = pos.column;
    if (l > line) {
        buf += newlines.substr(0, l - line);
        line = l;
        column = 0;
    }
    if (l === line && c > column) {
        buf += whitespaces.substr(0, c - column);
        column = c;
    }

    buf += str;
    column += str.length;
}

function append(str) {
    buf += str;
    column += str.length;
}