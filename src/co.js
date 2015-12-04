"use strict";

let Fiber = require('fibers');

exports.Fiber = Fiber;

exports.yield = function (result) {
    if (result instanceof Promise)
        return Fiber.yield(result);
    if (result instanceof Array && result.length && result[0] instanceof Promise) {
        return Fiber.yield(Promise.all(result))
    }

    return result;
};

exports.run = function (cb, arg) {
    return new Promise(function (resolve, reject) {
        let fiber = new Fiber(cb);

        sched(arg);
        function sched(args) {
            let result;
            try {
                result = fiber.run(args);
            } catch (e) {
                cleanup();
                return reject(e);
            }
            onresult(result);
        }

        function onerr(err) {
            let result;
            try {
                result = fiber.throwInto(err);
            } catch (e) {
                cleanup();
                return reject(e);
            }
            onresult(result);
        }

        function onresult(result) {
            if (!fiber.started) {
                cleanup();
                resolve(result);
                return;
            }
            result.then(sched, onerr);
        }

        function cleanup() {
            let resources = fiber.resources;
            if (resources) {
                fiber.resources = null;
                for (let handle of resources) {
                    handle._close();
                }
            }
            fiber = null;
        }
    });
};

exports.promise = function (cb) {
    return exports.yield(new Promise(cb));
};

exports.sync = function (fun) {
    let args = arguments;
    return exports.promise(function (resolve, reject) {
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
    });
};

exports.sleep = function (timeout) {
    exports.yield(new Promise(function (resolve) {
        setTimeout(resolve, timeout);
    }))
};

const resourceSets = new WeakMap();

exports.addResource = function (obj) {
    let fiber = Fiber.current,
        resources = fiber.resources || (fiber.resources = new Set());
    resourceSets.set(obj, resources);
    resources.add(obj);
};

exports.removeResource = function (obj) {
    resourceSets.get(obj);
    let resources = resourceSets.get(obj);
    if (resources) {
        resources.delete(obj);
        resourceSets.delete(obj);
    }
};