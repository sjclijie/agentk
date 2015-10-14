import Router from 'router';
import {fetch,parseQuery,Response} from 'http';
import {sha1} from 'crypto';

/**
 *
 * @param {object} options optional arguments, which contains:
 *   - login_url `string`: callback url when user is not login, defaults to `/login`
 *   - cookie_name `string`: cookie name used to save login info, defaults to `AKUID`
 *   - cookie_expires `number`: cookie expiration time in seconds, defaults to 30 days
 *   - cookie_domain `string`: cookie domain name, defaults to `qunar.com`
 *   - cookie_secret `string`: cookie encryption key, defaults to MAC address
 *   - admin_email `string`: admin email address to be shown up when user is not in the grant list
 *   - email_title `string`: default email title to be added when user is not in the grant list
 * @param {function} onuser callback called when user access, should return any value if user is permitted
 *   or `false` if user is not permitted
 */
export default function (options, onuser) {
    const login_url = options.login_url || '/login';
    const cookie_name = options.cookie_name || 'AKUID';
    const cookie_secret = sha1(options.cookie_secret || getMACAddr()); // buffer
    const cookie_expires = (options.cookie_expires || 30 * 86400) * 1000;
    const cookie_domain = options.cookie_domain || 'qunar.com';

    const login_resp = new Response(`<script src="https://qsso.corp.qunar.com/lib/qsso-auth.js"></script><script>QSSO.auth("${login_url}", {url: location.pathname+location.search});</script>`, {
        headers: {'Content-Type': 'text/html'}
    });
    login_resp.setCookie(cookie_name, '', {
        Domain: cookie_domain,
        Expires: new Date(0).toGMTString()
    });

    const relogin_resp = new Response(`<script src="https://qsso.corp.qunar.com/lib/qsso-auth.js"></script><script>function logout() {
        var js = document.createElement('SCRIPT');
        js.src = 'https://qsso.corp.qunar.com/api/logout.php?callback=onlogout';
        document.getElementsByTagName('HEAD')[0].appendChild(js);
    }
    function onlogout() {
        QSSO.auth("${login_url}");
    }
    </script><p>您无权访问系统，请
        <a href="mailto:${options.admin_email}?title=${encodeURIComponent(options.email_title || 'Add Permission to xxxx')}">联系管理员</a> 或
        <a href="javascript:logout()">重新登录</a>
    </p>`, {
        headers: {'Content-Type': 'text/html'}
    });
    relogin_resp.setCookie(cookie_name, '', {
        Domain: cookie_domain,
        Expires: new Date(0).toGMTString()
    });
    let crypto = require('crypto');

    return function (req) {
        if (req.pathname === login_url) {
            if (req.method === 'GET') {
                return login_resp;
            }
            if (req.method === 'POST') {
                let body = co.yield(req.text()),
                    formData = parseQuery(body);
                if (!formData.token) {
                    return Response.error(400, 'bad request payload');
                }

                let resp = co.yield(fetch("http://qsso.corp.qunar.com/api/verifytoken.php?token=" + encodeURIComponent(formData.token)));
                if (!resp.ok) {
                    return resp;
                }
                let result = co.yield(resp.json());

                if (!result.ret) {
                    return resp;
                }

                let userid = result.userId;
                if (onuser(userid) === false) {
                    return relogin_resp;
                }
                let cipher = crypto.createCipher('aes-128-cbc', cookie_secret);
                let ciphered = Buffer.concat([cipher.update(userid, 'binary'), cipher.final()]);
                let cookie = ciphered.toString('base64').replace(/\+/g, '-').replace(/\//g, '*');
                cookie = cookie.substr(0, cookie.length === 24 ? 22 : cookie.length === 44 ? 43 : cookie.length);

                resp = Response.redirect(formData.url);
                // set cookie
                resp.setCookie(cookie_name, cookie, {
                    Path: '/',
                    Domain: cookie_domain,
                    Expires: new Date(Date.now() + cookie_expires).toGMTString()
                });
                return resp;
            }

            return Response.error(400, 'bad request method');
        }

        let cookie = req.cookies[cookie_name];
        if (cookie && (cookie.length === 22 || cookie.length === 43 || cookie.length === 64) && /^[0-9a-zA-Z\-\*]+$/.test(cookie)) { // cookie is good
            let ciphered = new Buffer(cookie.replace(/\*/g, '/').replace(/-/g, '+'), 'base64');

            let decipher = crypto.createDecipher('aes-128-cbc', cookie_secret);
            let userid = decipher.update(ciphered) + decipher.final();
            let info = onuser(userid);
            if (info === false) {
                return relogin_resp
            }
            req.user = {id: userid, info};
            return;
        }
        return login_resp;
    };
}

function getMACAddr() {
    let map = require('os').networkInterfaces();
    for (let key in map) {
        let obj = map[key][0];
        if (!obj.internal) return obj.mac;
    }
    return '00:00:de:ad:be:ef';
}