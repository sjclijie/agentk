/**
 * Session manager
 *
 * @usage
 *
 *     import session from 'session';
 *
 *     session(router, {
 *         'expires': 30*60
 *     }))
 */

/**
 * Creates a session handler
 *
 * @param {object} [options] optional arguments like:
 *   - expires `number` time before expiration, in seconds. default: 1800
 *   - maxusers `number` maximum number of users
 */
export default function (router, options) {
    let expiration = 1800;
    if (options) {
        if ('expires' in options) {
            expiration = options.expires | 0;
        }
    }
    let sessions = {}; // sessid: {expires, value}

    router.all(function (req) {
        let cookieid = req.cookies.AKSESSID;
        if (!/^[0-9a-fA-F]{16}$/.test(cookieid)) {
            req.session = {};
        } else if (cookieid in sessions) {
            let sess = sessions[cookieid];
            req.session = sess.value;
            sess.expires = expiration * 1000 + Date.now();
        } else {
            sessions[cookieid] = {
                expires: expiration * 1000 + Date.now(),
                value: req.session = {}
            };
        }
    });
    router.complete(function (req, res) {

    })
}