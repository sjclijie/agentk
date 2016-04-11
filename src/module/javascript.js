let UglifyJS, compressor;

const esprima = process.mainModule.require('./src/javascript/esprima');

export const parse = esprima.parse;
export const Syntax = esprima.Syntax;
export const transform = process.mainModule.require('./src/javascript/transformer').transform;
export const build = process.mainModule.require('./src/javascript/builder');
export const minify = function (code) {
    if (!UglifyJS) {
        require('../lib/uglify');
        UglifyJS = global.UglifyJS;
        compressor = UglifyJS.Compressor();
    }

    let ast = UglifyJS.parse(code);
    ast.figure_out_scope();
    ast = ast.transform(compressor);
    ast.figure_out_scope();
    ast.compute_char_frequency();
    ast.mangle_names();
    return ast.print_to_string();
};

export const Statement = {
    returns(argument) {
        return {type: Syntax.ReturnStatement, argument}
    },
    decl(kind) {
        let stmt = {type: Syntax.VariableDeclaration, kind};

        let decls = stmt.declarations = [];
        for (let i = 1, len = arguments.length; i < len; i += 2) {
            const id = arguments[i];
            decls.push({
                type: Syntax.VariableDeclarator,
                id: typeof id === 'string' ? Expression.id(id) : id,
                init: arguments[i + 1]
            })
        }
        return stmt;
    },

    If(test, consequent, alternate) {
        return {
            type: Syntax.IfStatement,
            test,
            consequent: consequent || {type: Syntax.EmptyStatement},
            alternate
        };
    },

    Block(body) {
        return {type: Syntax.BlockStatement, body}
    },

    Break: {type: Syntax.BreakStatement}
};

export class Expression {
    constructor(type) {
        this.type = type;
    }

    toStatement() {
        return {type: Syntax.ExpressionStatement, expression: this};
    }

    member(property, computed) {
        let expr = new Expression(Syntax.MemberExpression);
        expr.object = this;
        expr.property = typeof property === 'string' ? Expression.id(property) : property;
        expr.computed = computed;
        return expr;
    }

    call(member, args) {
        let callee;
        if (typeof member === 'string') {
            callee = this.member(member);
        } else {
            callee = this;
            args = member;
        }
        let expr = new Expression(Syntax.CallExpression);
        expr.callee = callee;
        expr.arguments = args;
        return expr;
    }

    assign(right) {
        let expr = new Expression(Syntax.AssignmentExpression);
        expr.left = this;
        expr.operator = '=';
        expr.right = right;
        return expr;
    }

    binary(operator, right) {
        let expr = new Expression(Syntax.BinaryExpression);
        expr.left = this;
        expr.operator = operator;
        expr.right = right;
        return expr;
    }

    unary(operator, prefix = true) {
        let expr = new Expression(Syntax.UnaryExpression);
        expr.operator = operator;
        expr.argument = this;
        expr.prefix = prefix;
        return expr;
    }

    cond(consequent, alternate) {
        let expr = new Expression(Syntax.ConditionalExpression);
        expr.test = this;
        expr.consequent = consequent;
        expr.alternate = alternate;
        return expr;
    }

    static id(string) {
        let expr = new Expression(Syntax.Identifier);
        expr.name = string;
        return expr;
    }

    static raw(string) {
        let expr = new Expression(Syntax.Literal);
        expr.raw = '' + string;
        return expr;
    }

    static func(params, body) {
        let expr = new Expression(Syntax.FunctionExpression);
        expr.params = params;
        expr.body = {type: Syntax.BlockStatement, body};
        return expr;
    }
}

Expression.This = new Expression(Syntax.ThisExpression);
