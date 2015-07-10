"use strict";

let Fiber = require('fibers');
exports.yield = Fiber.yield;

exports.promise = function (cb) {
    let finished = false;
    return new Promise(function (resolve, reject) {
        let fiber = Fiber(function () {
            let ret = cb();
            finished = true;
            return ret;
        });

        sched();
        function sched(args) {
            let result;
            try {
                result = fiber.run(args);
            } catch (e) {
                return reject(e);
            }
            onresult(result);
        }

        function onerr(err) {
            let result;
            try {
                result = fiber.throwInto(err);
            } catch (e) {
                return reject(e);
            }
            onresult(result);
        }

        function onresult(result) {
            if (finished) {
                resolve(result);
                return;
            }
            if (result instanceof Promise) {
                result.then(sched, onerr);
            } else {
                process.nextTick(sched, result);
            }
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
