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
        this.callers = [];

        if (cb) {
            this.callers.push({handle: cb, prefix: '', suffix: ''})
        }
        this.compile = router_compile;
    }

    add(handle) {
        this.compile = router_compile;
        this.callers.push(handle)
    }

    all(cb) {
        this.add({handle: cb, prefix: '', suffix: ''})
    }

    exact(url, cb) {
        this.add({
            handle: cb,
            prefix: 'if(pathname === ' + JSON.stringify(url) + ') {\n',
            suffix: '}\n'
        });
    }

    prefix(prefix, cb) {
        let ret = new Router(cb);
        if (prefix[prefix.length - 1] !== '/') {
            prefix += '/';
        }
        let len = prefix.length, $0 = JSON.stringify(prefix);
        this.add({
            handle: ret,
            prefix: `if(pathname.substr(0, ${len}) === ${$0}) {\n  const $0 = pathname;\n  pathname = req.pathname = pathname.substr(${len - 1});\n`,
            suffix: '  pathname = req.pathname = $0\n}'
        });
        return ret;
    }

    match(pattern, cb) {
        let handle = new Router(cb);
        this.add({
            handle,
            prefix: 'const $0 = ' + pattern + '.exec(pathname);\nif($0) {\n  const $1 = args;\n  $0[0] = req;\n  args = $0;\n',
            suffix: '  args = $1;\n}'
        });

        return handle;
    }

    test(tester) {
        let handle = new Router();
        this.add({
            handle,
            prefix: 'if($0.apply(req, args)) {\n',
            suffix: '}',
            args: [tester]
        });

        return handle;
    }

    catcher(cb) {
        let ret = new Router();
        this.add({
            handle: ret,
            prefix: 'tryCatch(function (req, pathname, args) {do {\n',
            suffix: '} while(0);}, $0); if(_ !== Z) break;\n',
            args: [cb]
        });
        return ret;
    }

    apply(req, args) {
        this.compile();
        return this._compiled.apply(req, args);
    }

    complete(cb) {
        this.compile = router_compile;
        if (this.completions) {
            this.completions.push(cb);
        } else {
            this.completions = [cb];
        }
    }
}

function router_compile() {
    let handle = $compile(this, 0, 0, 0);

    let code = handle.code;
    // optimize matches
    code = code.replace(/const _(\d+) = pathname;\n  pathname = (req\.pathname = pathname.substr\(\d+\);\n(?:\$invoke\(\$\d+\)\n)+)  pathname = req\.pathname = _\1/g, '$2  req.pathname = pathname');
    // optimize exact
    code = code.replace(/(if\(pathname === "\/.*?")\) \{\n\$invoke\((\$\d+)\)\n\}/g, '$1 && (_ = $2.apply(req, args)) !== Z) break;');
    // optimize match
    code = code.replace(/const _(\d+) = args;\n  _(\d+)\[0\] = req;\n  args = _\2;\n\$invoke\((\$\d+)\)\n  args = _\1;/g, '_$2[0] = req;\n  if((_ = $3.apply(req, _$2)) !== Z) break;');
    // replace invokes
    code = code.replace(/\$invoke\((\$\d+)\)/g, 'if((_ = $1.apply(req, args)) !== Z) break;');

    this.compile = Boolean;
    let args = handle.args;
    let argnames = '';
    for (let i = 0; i < handle.first_arg; i++) {
        argnames += '$' + i + ','
    }
    argnames += 'slice';
    args.push(args.slice);
    code = '"use strict";\nreturn function (req) {\n'
        + 'let args = slice.call(arguments), _, pathname = req.pathname, completions = [];\n'
        + 'req.rewrite = function(pattern, repl) {const m = pattern.exec(pathname);if(m){pathname = req.pathname = repl.replace(/\\$(\\$|\\d+)/g,function(_,n){return m[n]})}};\n'
        + 'function tryCatch(method, catcher) { try {method.call(req, req, pathname, args)} catch(e) {_ = catcher.apply(req, [req, e])} }\n'
        + 'do{' + code + '}while(0);\nfor(let i = completions.length; i--;) _ = completions[i](req, _);\nreturn _}';
    //require('fs').writeFile('router.js', 'function test(' + argnames + ',Z){' + code + '}');
    this._compiled = new Function(argnames + ',Z', code).apply(null, args);
}

function $compile(cb, first_arg, first_xarg, completions) {
    if (typeof  cb === 'function') {
        return {
            code: '$invoke($' + first_arg + ')\n',
            args: [cb],
            first_arg: first_arg + 1,
            first_xarg: first_xarg
        }
    }


    let args = [], code = '', compLen = cb.completions ? cb.completions.length : 0;
    if (compLen) {
        args = cb.completions.slice();
        for (let i = 0; i < compLen; i++) {
            code += ',$' + first_arg++;
        }
        code = 'completions.push(' + code.substr(1) + ');'
    }
    for (let caller of cb.callers) {
        //console.log(caller);
        let argc = caller.args ? caller.args.length : 0, maxExtras = -1;
        var prefix = caller.prefix.replace(/\$(\d)\b/g, replacement),
            suffix = caller.suffix.replace(/\$(\d)\b/g, replacement);
        let handle = $compile(caller.handle, first_arg + argc, first_xarg + maxExtras + 1, completions + compLen);

        code += prefix + handle.code + suffix;


        function replacement(m, u) {
            u = u | 0;
            if (u >= argc) { // extra arg
                u -= argc;
                if (u > maxExtras) {
                    maxExtras = u;
                }
                return '_' + (first_xarg + u);
            }
            return '$' + (first_arg + u)
        }

        if (argc) {
            args = args.concat(caller.args, handle.args);
        } else {
            args = args.concat(handle.args);
        }
        first_arg = handle.first_arg;
        first_xarg = handle.first_xarg;
    }
    if (compLen) {
        code += 'completions.length=' + completions + ';';
    }
    return {
        code: code,
        args: args,
        first_arg: first_arg,
        first_xarg: first_xarg
    }
}
