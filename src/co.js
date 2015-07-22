"use strict";

let Fiber = require('fibers');
exports.yield = function (result) {
    if (result instanceof Promise)
        return Fiber.yield(result);
    return result;
};

exports.promise = function (cb, arg) {
    return new Promise(function (resolve, reject) {
        let fiber = new Fiber(cb);

        sched(arg);
        function sched(args) {
            let result;
            try {
                result = fiber.run(args);
            } catch (e) {
                fiber = null;
                return reject(e);
            }
            onresult(result);
        }

        function onerr(err) {
            let result;
            try {
                result = fiber.throwInto(err);
            } catch (e) {
                fiber = null;
                return reject(e);
            }
            onresult(result);
        }

        function onresult(result) {
            if (!fiber.started) {
                fiber = null;
                resolve(result);
                return;
            }
            result.then(sched, onerr);
        }
    });
};

exports.wrap = function (cb) {
    return exports.yield(new Promise(cb));
};

exports.async = function (fun) {
    let args = arguments;
    return exports.yield(new Promise(function (resolve, reject) {
        if (args.length === 1) {
            fun(cb)
        } else if (args.length === 2) {
            fun(args[1], cb)
        } else if (args.length === 3) {
            fun(args[1], args[2], cb)
        } else {
            let arr = Array.prototype.slice.call(args, 1);
            arr.push(cb);
            fun.apply(null, arr)
        }
        function cb(err, result) {
            if (err) reject(err);
            else resolve(result)
        }
    }));
};

exports.sleep = function (timeout) {
    exports.yield(new Promise(function (resolve) {
        setTimeout(resolve, timeout);
    }))
}
