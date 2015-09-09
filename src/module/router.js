/**
 *
 * @param {function|Router} [cb] handler first called before all rules
 * @returns {Router}
 * @constructor
 */
function Router(cb) {
    if (!(this instanceof Router))
        return new Router(cb);
    this.callers = [];

    if (cb) {
        this.callers.push({handle: cb, prefix: '', suffix: ''})
    }
}

Router.prototype.add = function (handle) {
    delete this.compile;
    this.callers.push(handle)
};

Router.prototype.all = function (cb) {
    this.add({handle: cb, prefix: '', suffix: ''})
};

Router.prototype.exact = function (url, cb) {
    this.add({
        handle: cb,
        prefix: 'if(req.pathname === ' + JSON.stringify(url) + ') {',
        suffix: '}'
    });
};


Router.prototype.prefix = function (prefix, cb) {
    let ret = new Router(cb);
    if (prefix[prefix.length - 1] !== '/') {
        prefix += '/';
    }
    let len = prefix.length, $0 = JSON.stringify(prefix);
    this.add({
        handle: ret,
        prefix: `if(req.pathname.substr(0, ${len}) === ${$0}) {
    var $1 = req.pathname, $2 = req.url;
    req.pathname = $1.substr(${len - 1});
    req.url = $2.substr(${len - 1});`,
        suffix: '  req.pathname = $1;\n  req.url = $2\n}'
    });
    return ret;
};

Router.prototype.match = function (pattern, cb) {
    let ret = new Router(cb);
    this.add({
        handle: ret,
        prefix: 'var $0 = ' + pattern + '.exec(req.pathname);\n' +
        'if($0) {\n' +
        '  var $1 = args;\n' +
        '  $0[0] = req;\n' +
        ' args = $0;',
        suffix: '  args=$1;\n' +
        '}'
    });

    return ret;
};


Router.prototype.catcher = function (cb) {
    let ret = new Router();
    this.add({
        handle: ret,
        prefix: 'try {',
        suffix: '} catch($1) {\n' +
        '  var $2 = args;\n' +
        '  args = [req, $1];\n' +
        '  $invoke($0)\n' +
        '  args = $2;\n}',
        args: [cb]
    });
    return ret;
};

function compile(cb, first_arg, first_xarg) {
    if (typeof  cb === 'function') {
        return {
            code: '$invoke($' + first_arg + ')',
            args: [cb],
            first_arg: first_arg + 1,
            first_xarg: first_xarg
        }
    }

    let args = [], code = '';
    for (let caller of cb.callers) {
        //console.log(caller);
        let argc = caller.args ? caller.args.length : 0, maxExtras = 0;
        let prefix = caller.prefix.replace(/\$(\d)\b/g, replacement),
            suffix = caller.suffix.replace(/\$(\d)\b/g, replacement);
        let handle = compile(caller.handle, first_arg + argc, first_xarg + maxExtras);
        code += prefix + '\n' + handle.code + '\n' + suffix;


        function replacement(m, u) {
            u = u | 0;
            if (u >= argc) { // extra arg
                if (u > maxExtras) {
                    maxExtras = u;
                }
                return '$$' + (first_xarg + u);
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

Router.prototype.compile = function () {
    let handle = compile(this, 0, 0);
    this.compile = Boolean;
    let args = handle.args;
    let argnames = '';
    for (let i = 0; i < handle.first_arg; i++) {
        argnames += '$' + i + ','
    }
    argnames += 'slice';
    args.push(args.slice);
    let code = 'function router(req) {var args = slice.call(arguments), _;\n' + handle.code.replace(/\$invoke\((\$\w+)\)/g, 'if((_ = $1.apply(req, args)) !== Z) return _;') + '}';
    if (this.completions) {
        args = args.concat(this.completions);
        let wrapping = 'router.apply(req, arguments)';
        for (let i = 0, L = this.completions.length; i < L; i++) {
            wrapping = 'c' + i + '(req, ' + wrapping + ')';
            argnames += ',c' + i;
        }
        code = 'return function(req) {return ' + wrapping + '};\n' + code
    } else {
        code = 'return ' + code;
    }
    //console.log('function test(){' + code + '}');
    this._compiled = new Function(argnames + ',Z', code).apply(null, args);
};


Router.prototype.apply = function (req, args) {
    this.compile();
    return this._compiled.apply(req, args);
};

Router.prototype.complete = function (cb) {
    delete this.compile;
    if (this.completions) {
        this.completions.push(cb);
    } else {
        this.completions = [cb];
    }
};


export default Router;
