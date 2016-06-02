import {Syntax, Expression, Statement, build} from 'javascript.js';

const id = Expression.id, raw = Expression.raw, decl = Statement.decl, block = Statement.Block;

const $pathname = id('pathname'),
    $_ = id('_'),
    $req = id('req'),
    $args = id('args'),
    $undefined = id('undefined'),
    $completions = id('completions');

function doWhile0(stmts) {
    return {
        type: Syntax.DoWhileStatement,
        body: block(stmts),
        test: raw(0)
    }
}

const stmts = [], params = [], comp_init = decl('const', $completions, raw('[]')), comp_run = raw('for(let i = completions.length; i--;) _ = completions[i](req, _)').toStatement(), ast = {
    type: Syntax.Program,
    body: [Expression.func(params, [
        decl('const', $undefined, raw('void 0')),
        Statement.returns(Expression.func([$req, $args], [
            raw('"use strict"').toStatement(),
            decl('let', $_, null, $pathname, $req.member($pathname)),
            raw('function tryCatch(handle, cb) {try{handle(req, pathname, args)}catch(e) {_ = cb.apply(req, [req, e])}} req.rewrite = function(p, r) {const m = p.exec(pathname); if(m) req.pathname = pathname = r.replace(/\\$(\\d+|\\$)/g, function(p, n) {return n === "$" ? "$" : m[n] || ""})}').toStatement(),
            comp_init,
            doWhile0(stmts),
            comp_run,
            Statement.returns($_)
        ]))]).toStatement()
    ]
};

export default class Router {
    /**
     *
     * @param {function|Router} [cb] handler first called before all rules
     * @returns {Router}
     * @constructor
     */
    constructor(cb) {
        if (!(this instanceof Router))
            return new Router(cb);
        this.entries = [];
        if (cb) this.all(cb);
    }

    all(cb) {
        this.entries.push({type: 'all', handle: cb})
    }

    exact(url, cb) {
        this.entries.push({type: 'exact', pathname: url, handle: cb});
    }

    prefix(prefix, cb) {
        if (prefix[prefix.length - 1] !== '/') {
            prefix += '/';
        }
        const ret = new Router(cb);
        this.entries.push({type: 'prefix', prefix: prefix, handle: ret});
        return ret;
    }

    match(pattern, cb) {
        const ret = new Router(cb);
        this.entries.push({type: 'match', pattern: pattern, handle: ret});
        return ret;
    }

    catcher(cb) {
        const ret = new Router();
        this.entries.push({type: 'catcher', cb: cb, handle: ret});
        return ret;
    }

    //noinspection InfiniteRecursionJS
    apply(req, args) {
        this._compile();
        return this.apply(req, args);
    }

    complete(cb) {
        if (this.completions) {
            this.completions.push(cb);
        } else {
            this.completions = [cb];
        }
    }

    _compile() {
        let nextLocal = 0, completionLen = 0, hasCompletion = false;

        const externals = [];

        compile(this, stmts);
        comp_init.type = hasCompletion ? Syntax.VariableDeclaration : Syntax.EmptyStatement;
        comp_run.type = hasCompletion ? Syntax.ExpressionStatement : Syntax.EmptyStatement;
        //require('fs').writeFileSync('ast.json', JSON.stringify(ast, null, 2));
        const script = build(ast);
        //require('fs').writeFileSync('out.js', script);

        this.apply = (0, eval)(script).apply(null, externals);

        stmts.length = params.length = 0;

        function compile(handle, stmts) {
            if (!handle || !handle.apply) return;
            if (!handle.entries) {
                const If = Statement.If(
                    $_.assign(newExternal(handle).member('apply').call([$req, $args])).binary('!==', $undefined),
                    Statement.Break
                );
                If.isSimpleCall = true;
                stmts.push(If);
                return;
            }

            const completions = handle.completions;
            if (completions) {
                hasCompletion = true;
                stmts.push(id('completions.push').call(completions.map(newExternal)).toStatement());
                completionLen += completions.length;
            }

            for (let entry of handle.entries) {
                switch (entry.type) {
                    case 'catcher': // {cb, handle}
                    {
                        const body = [];

                        compile(entry.handle, body);

                        stmts.push(
                            id('tryCatch').call([
                                Expression.func([$req, $pathname, $args], [doWhile0(body)]),
                                newExternal(entry.cb)
                            ]).toStatement(),
                            Statement.If(
                                $_.binary('!==', $undefined),
                                Statement.Break
                            )
                        );
                        break;
                    }
                    case 'prefix': // {prefix, handle}
                    {
                        const body = [];
                        compile(entry.handle, body);

                        stmts.push(Statement.If(
                            id('pathname.substr').call([raw(0), raw(entry.prefix.length)]).binary(
                                '===',
                                raw(JSON.stringify(entry.prefix))
                            ),
                            block(body)
                        ));
                        const $req_pathname = id('req.pathname');

                        const trim_pathname = $req_pathname.assign(id('pathname.substr').call([raw(entry.prefix.length - 1)]));
                        if (body.length === 1 && body[0].isSimpleCall) {
                            body.unshift(trim_pathname.toStatement());
                            body.push($req_pathname.assign($pathname).toStatement());
                        } else {
                            const $0 = newLocal($pathname);
                            body.unshift(
                                decl('const', $0.id, $0.init),
                                $pathname.assign(trim_pathname).toStatement()
                            );
                            body.push($pathname.assign($req_pathname.assign($0.id)).toStatement());
                        }
                        break;
                    }
                    case 'match': // {pattern, handle}
                    {
                        const $0 = newLocal(id(entry.pattern + '.exec').call([$pathname]));
                        const body = [];
                        compile(entry.handle, body);

                        const assign_req = $0.id.member(raw(0), true).assign($req);

                        if (body.length === 1 && body[0].isSimpleCall) {
                            const stmt = body[0];
                            stmt.test.left.right.arguments[1] = $0.id;
                            stmt.test = $0.id.binary('&&', {
                                type: Syntax.SequenceExpression,
                                expressions: [assign_req, stmt.test]
                            });
                            stmts.push(decl('const', $0.id, $0.init), stmt);
                        } else {
                            const $1 = newLocal($args);
                            body.unshift(
                                decl('const', $1.id, $1.init),
                                assign_req.toStatement(),
                                $args.assign($0.id).toStatement()
                            );
                            body.push($args.assign($1.id).toStatement());
                            stmts.push(
                                decl('const', $0.id, $0.init),
                                Statement.If($0.id, block(body))
                            );
                        }


                        break;
                    }
                    case 'exact': // {pathname, handle}
                    {
                        const body = [];
                        compile(entry.handle, body);
                        const test = $pathname.binary('===', raw(JSON.stringify(entry.pathname)));

                        if (body.length === 1 && body[0].isSimpleCall) {
                            const stmt = body[0];
                            stmt.test = test.binary('&&', stmt.test);
                            stmts.push(stmt);
                        } else {
                            stmts.push(Statement.If(
                                $pathname.binary('===', raw(JSON.stringify(entry.pathname))),
                                block(body)
                            ));
                        }
                        break;
                    }
                    case 'all':
                        compile(entry.handle, stmts);
                        break;
                }
            }

            if (completions) stmts.push(id('completions.length').assign(raw(completionLen -= completions.length)).toStatement())

        }

        function newLocal(init) {
            return {
                type: Syntax.VariableDeclarator,
                id: id('_' + nextLocal++),
                init: init
            };
        }

        function newExternal(value) {
            const arg = id('$' + externals.length);
            externals.push(value);
            params.push(arg);
            return arg;
        }

    }
}
