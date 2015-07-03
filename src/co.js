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

exports.async = function (cb, args) {
    return exports.yield(new Promise(function (resolve, reject) {
        args.push(function (err, result) {
            if (err) reject(err);
            else resolve(result)
        });
        cb.apply(null, args);
    }));
};