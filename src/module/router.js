function Router(cb) {
    if (!(this instanceof Router))
        return new Router();
    this.nexts = [];
    if (cb) {
        this.nexts.push(cb)
    }
}

Router.prototype.all = function (cb) {
    let ret = new Router(cb);
    this.nexts.push(ret);
    return ret;
};

Router.prototype.exact = function (url, cb) {
    let ret = new Router(cb);
    this.nexts.push(function (req) {
        if (req.url === url) {
            return ret.apply(req, arguments);
        }
    });
    return ret;
};

Router.prototype.prefix = function (prefix, cb) {
    if (prefix[prefix.length - 1] !== '/') {
        prefix += '/';
    }
    let ret = new Router(cb);
    this.nexts.push(function (req) {
        if (req.url.substr(0, prefix.length) === prefix) {
            req.url = req.url.substr(prefix.length - 1);
            return ret.apply(req, arguments);
        }
    });
    return ret;
};

Router.prototype.match = function (pattern, cb) {
    let ret = new Router(cb);
    this.nexts.push(function (req) {
        let m = pattern.exec(req.url);
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
    let originalUrl = req.url;
    for (let tester of this.nexts) {
        let result = tester.apply(req, args);
        if (result !== undefined) { // end
            return result;
        }
        req.url = originalUrl;
    }
};

function nop() {
}

export default Router;
