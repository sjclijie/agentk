/**
 *
 * @param {function|Router} [cb] handler first called before all rules
 * @returns {Router}
 * @constructor
 */
function Router(cb) {
    if (!(this instanceof Router))
        return new Router();
    this.nexts = [];
    if (cb) {
        this.nexts.push(cb)
    }
}

Router.prototype.all = function (cb) {
    this.nexts.push(cb);
};

Router.prototype.exact = function (url, cb) {
    this.nexts.push(function (req) {
        if (req.pathname === url) {
            return cb.apply(req, arguments);
        }
    });
};

Router.prototype.prefix = function (prefix, cb) {
    if (prefix[prefix.length - 1] !== '/') {
        prefix += '/';
    }
    let ret = new Router(cb);
    this.nexts.push(function (req) {
        if (req.pathname.substr(0, prefix.length) === prefix) {
            req.pathname = req.pathname.substr(prefix.length - 1);
            req.url = req.url.substr(prefix.length - 1);
            return ret.apply(req, arguments);
        }
    });
    return ret;
};

Router.prototype.match = function (pattern, cb) {
    let ret = new Router(cb);
    this.nexts.push(function (req) {
        let m = pattern.exec(req.pathname);
        if (m) {
            m[0] = req;
            return ret.apply(req, m);
        }
    });
    return ret;
};

Router.prototype.catcher = function (cb) {
    let ret = new Router();
    this.nexts.push(function (req) {
        try {
            return ret.apply(req, arguments)
        } catch (e) {
            return cb.apply(req, [req, e]);
        }
    });
    return ret;
};

Router.prototype.apply = function (req, args) {
    req = args[0];
    let originalUrl = req.url, originalPath = req.pathname;
    for (let tester of this.nexts) {
        let result = tester.apply(req, args);
        if (result !== undefined) { // end
            return result;
        }
        req.url = originalUrl;
        req.pathname = originalPath;
    }
};

function nop() {
}

export default Router;
