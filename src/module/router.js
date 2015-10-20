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
        let ret = new Router(cb);
        this.add({
            handle: ret,
            prefix: 'const $0 = ' + pattern + '.exec(pathname);\nif($0) {\n  const $1 = args;\n  $0[0] = req;\n  args = $0;\n',
            suffix: '  args = $1;\n}'
        });

        return ret;
    }

    catcher(cb) {
        let ret = new Router();
        this.add({
            handle: ret,
            prefix: 'try {\n',
            suffix: '} catch($1) {\n  if((_ = $0.apply(req, [req, $1])) !== Z) return _;\n}\n',
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
    let handle = $compile(this, 0, 0, '');

    let code = handle.code;
    // optimize matches
    code = code.replace(/const _(\d+) = pathname;\n  pathname = (req\.pathname = pathname.substr\(\d+\);\n(?:\$invoke\(\$\d+\)\n)+)  pathname = req\.pathname = _\1/g, '$2  req.pathname = pathname');
    // optimize exact
    code = code.replace(/(if\(pathname === "\/.*?")\) \{\n\$invoke\((\$\d+)\)\n\}/g, '$1 && (_ = $2.apply(req, args)) !== Z) return _;');
    // optimize match
    code = code.replace(/const _(\d+) = args;\n  _(\d+)\[0\] = req;\n  args = _\2;\n\$invoke\((\$\d+)\)\n  args = _\1;/g, '_$2[0] = req;\n  if((_ = $3.apply(req, _$2)) !== Z) return _;');
    // replace invokes
    code = code.replace(/\$invoke\((\$\d+)\)/g, 'if((_ = $1.apply(req, args)) !== Z) return _;');

    this.compile = Boolean;
    let args = handle.args;
    let argnames = '';
    for (let i = 0; i < handle.first_arg; i++) {
        argnames += '$' + i + ','
    }
    argnames += 'slice';
    args.push(args.slice);
    code = 'function router(req) {let args = slice.call(arguments), _, pathname = req.pathname;\n' + code + '}';
    if (this.completions) {
        args = args.concat(this.completions);
        let wrapping = 'router.apply(req, arguments)';
        for (let i = 0, L = this.completions.length; i < L; i++) {
            wrapping = 'c' + i + '(req, ' + wrapping + ')';
            argnames += ',c' + i;
        }
        code = '"use strict";\nreturn function(req) {return ' + wrapping + '};\n' + code
    } else {
        code = '"use strict";\nreturn ' + code;
    }
    //console.log('function test(' + argnames + ',Z){' + code + '}');
    this._compiled = new Function(argnames + ',Z', code).apply(null, args);
}

function $compile(cb, first_arg, first_xarg) {
    if (typeof  cb === 'function') {
        return {
            code: '$invoke($' + first_arg + ')\n',
            args: [cb],
            first_arg: first_arg + 1,
            first_xarg: first_xarg
        }
    }

    let args = [], code = '';
    for (let caller of cb.callers) {
        //console.log(caller);
        let argc = caller.args ? caller.args.length : 0, maxExtras = -1;
        var prefix = caller.prefix.replace(/\$(\d)\b/g, replacement),
            suffix = caller.suffix.replace(/\$(\d)\b/g, replacement);
        let handle = $compile(caller.handle, first_arg + argc, first_xarg + maxExtras + 1);
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
    return {
        code: code,
        args: args,
        first_arg: first_arg,
        first_xarg: first_xarg
    }
}
