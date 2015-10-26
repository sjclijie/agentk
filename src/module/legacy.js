/**
 * Converts some popular code styles into AgentK style.
 *
 * @title Legacy support module
 */

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
            const response = req.response, _end = response.end;
            response.end = function () {
                _end.apply(response, arguments);
                response.writeHead = response.end = Boolean;
                resolve(false);
            };

            cb(req.request, response, function (err) {
                response.end = _end;
                // next called
                if (err) reject(err);
                else resolve();
            })
        })
    }
}