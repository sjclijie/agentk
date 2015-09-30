/**
 * Converts some popular code styles into AgentK style.
 *
 * @title Legacy support module
 */

const emptyHandler = {
    handle: Boolean
};


/**
 * Wrap an connect/express style middleware into AgentK route handler
 *
 * @example
 *
 *     import Router from 'router';
 *     import {middleware} from 'legacy';
 *     let cookieParser = require('cookie-parser')()
 *     let route = new Router();
 *     route.prefix('/user/', middleware(function (req, res, next) {
 *         // express style code here
 *     }));
 *     route.prefix('/static/', middleware(cookieParser))
 *
 * @param cb middleware callback with 3 arguments:
 *
 *   1. req: request object
 *   2. res: response object
 *   3. next: called on success or failed
 *
 * @returns {function}
 */
export function middleware(cb) {
    return function (req) {
        return co.promise(function (resolve, reject) {
            let res = req.response;
            initResponse(res, resolve);
            cb(req, res, function (err) {
                if (err) reject(err);
                else resolve();
            })
        })
    }
}

function initResponse(res, resolve) {
    if (res.hasOwnProperty('_resolvers')) {
        res._resolvers.push(resolve);
    } else {
        const resolvers = res._resolvers = [resolve];
        const $end = res.end;
        res.end = function () {
            $end.apply(res, arguments);
            for (let i = 0, L = resolvers.length; i < L; i++) {
                resolvers[i](emptyHandler);
            }
        }
    }
}