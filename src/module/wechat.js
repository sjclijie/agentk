/**
 * WeChat module
 *
 * @example
 *
 *     import * as wechat from 'module/wechat';
 *     wechat.token = 'xxxx';
 *     wechat.addMessageReceiver('gh_xxxxxxxxxx', 'wxdexxxxxxxxxxxxef', 'AAAA...AAA');
 *
 */

import {parse,build} from 'xml';
import {sha1,md5,cipheriv,decipheriv} from 'crypto';
import {fetch,Response} from 'http';

import {info,warn} from 'logger';

const receivers = {}; // name => Receiver
const users = {}; // userid => Receiver

const CLIENT_ERROR = Response.error(403);

const _extend = require('util')._extend;

class WechatMessageReceiver {
    constructor(config) {

        _extend(this, config);
        if (config.encodingKey) {
            const aesKey = new Buffer(config.encodingKey + '=', 'base64'), aesIV = aesKey.slice(0, 16);
            this.aesKey = aesKey;
            this.aesIV = aesIV;
        }
    }

    /**
     *
     * @param {String} encrypted base64
     * @returns {String}
     */
    decrypt(encrypted) {
        let decrypted = decipheriv('aes-256-cbc', this.aesKey, this.aesIV, new Buffer(encrypted, 'base64'));
        let bodyEnd = decrypted.readUInt32BE(16) + 20;
        let appid = decrypted.toString('binary', bodyEnd, decrypted.length - decrypted[decrypted.length - 1]);
        if (appid !== this.appid) {
            throw new Error('receiver appid not match');
        }
        return decrypted.toString('utf8', 20, bodyEnd)

    }

    /**
     *
     * @param {String} plaintext
     * @returns {String} base64
     */
    encrypt(plaintext) {
        let appid = this.appid;
        let buffer = new Buffer(plaintext);

        let dataLen = buffer.length + appid.length + 20, padding = 32 - (dataLen & 31);

        let payload = new Buffer(dataLen + padding);
        payload.write(Math.random().toString(36), 0, 16, 'binary');
        payload.writeUInt32BE(buffer.length, 16, true);
        buffer.copy(payload, 20);
        payload.write(appid, buffer.length + 20, appid.length, 'binary');
        payload.fill(padding, dataLen);

        return cipheriv('aes-256-cbc', this.aesKey, this.aesIV, payload).toString('base64');
    }
}

export let token = '';

export function addMessageReceiver(name, config) {
    let receiver = receivers[name] = new WechatMessageReceiver(config);
    if (config.userid) {
        users[config.userid] = receiver;
    }
}


export function messageFilter(req) {
    // check request signature
    let hash = signature(req.query.timestamp, req.query.nonce);
    if (hash !== req.query.signature) {
        return CLIENT_ERROR
    }

    if (req.method === 'GET') { // echo
        return new Response(req.query.echostr);
    }

    let root = parse(co.yield(req.text()));
    let receiver = users[root.tousername.TEXT];
    if (!receiver) {
        return CLIENT_ERROR
    }

    req.receiver = receiver;

    if (req.query.encrypt_type === 'aes') {
        let encrypted = root.encrypt.TEXT;
        let msg_hash = signature(req.query.timestamp, req.query.nonce, encrypted);
        if (msg_hash !== req.query.msg_signature) {
            return CLIENT_ERROR
        }
        root = parse(receiver.decrypt(encrypted));
    }
    req.message = root;
}

export function respondText(req, text) {
    return respond(req, {
        MsgType: {TEXT: 'text'},
        Content: {TEXT: text, CDATA: true}
    });
}

export function respondNews(req, news) {
}

function respond(req, root) {
    let timestamp = (Date.now() / 1000 | 0) + '';
    root.ToUserName = {TEXT: req.message.fromusername.TEXT, CDATA: true};
    root.FromUserName = {TEXT: req.receiver.userid, CDATA: true};
    root.CreateTime = {TEXT: timestamp};

    let body = build(root);

    if (req.query.encrypt_type === 'aes') {
        let nonce = req.query.nonce;
        let encrypted = req.receiver.encrypt(body);
        body = build({
            ToUserName: {TEXT: req.message.fromusername.TEXT, CDATA: true},
            Encrypt: {TEXT: encrypted.toString('base64'), CDATA: true},
            MsgSignature: {TEXT: signature(timestamp, nonce, encrypted)},
            TimeStamp: {TEXT: timestamp},
            Nonce: {TEXT: nonce}
        });
    }

    return new Response(body);
}

function signature(timestamp, nonce, ...extra) {
    extra.push(token, timestamp, nonce);
    return sha1(extra.sort().join(''), 'hex');
}

export const SCOPE_BASE = 'snsapi_base';
export const SCOPE_USERINFO = 'snsapi_userinfo';

/**
 *
 * @param {String} name receiver name
 * @param {String} redirect_url
 * @param {String} [scope] SCOPE_BASE or SCOPE_USERINFO
 * @param {String} [state] defaults to '0'
 * @returns {Response}
 */
export function generateGrantCodeUrl(name, redirect_url, scope, state) {
    let receiver = receivers[name];

    return `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${receiver.appid
        }&redirect_uri=${encodeURIComponent(redirect_url)
        }&response_type=code&scope=${scope || SCOPE_BASE }&state=${state || 0}#wechat_redirect`
}

export function grantCode(name, redirect_url, scope, state) {
    return Response.redirect(generateGrantCodeUrl(name, redirect_url, scope, state))
}

export function getBaseInfo(name, code) {
    let receiver = receivers[name];

    let resp = co.yield(fetch(`https://api.weixin.qq.com/sns/oauth2/access_token?appid=${receiver.appid
        }&secret=${receiver.secret}&code=${code}&grant_type=authorization_code`));

    if (resp.ok) {
        return co.yield(resp.json());
    } else {
        throw {message: 'errno ' + resp.status, errno: resp.status}
    }
}

export function getUserInfo(access_token, openid) {
    let resp = co.yield(fetch(`https://api.weixin.qq.com/sns/userinfo?access_token=${access_token}&openid=${openid}&lang=zh_CN`));

    if (resp.ok) {
        return co.yield(resp.json());
    } else {
        throw {message: 'errno ' + resp.status, errno: resp.status}
    }
}

let cachedToken = {expires: 0};
export function getClientAccessToken(name) {
    let receiver = receivers[name];
    let now = Date.now();

    if (cachedToken.expires < now) {
        let resp = co.yield(fetch(`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${receiver.appid
            }&secret=${receiver.secret}`));
        if (resp.ok) {
            let ret = co.yield(resp.json());
            if (ret.errcode) {
                throw {message: ret.errmsg, errno: ret.errcode}
            }
            cachedToken = {
                access_token: ret.access_token,
                expires: now + ret.expires_in * 1000 - 3000
            };
        } else {
            throw {message: 'errno ' + resp.status, errno: resp.status}
        }
    }
    return cachedToken.access_token;

}


export function sendText(access_token, openid, text) {
    return send(access_token, openid, 'text', {
        content: text
    })
}

function send(access_token, openid, type, obj) {

    let data = {
        touser: openid,
        msgtype: type
    };
    data[type] = obj;

    console.log('send', data, access_token);

    let resp = co.yield(fetch(`https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token=${access_token}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    }));

    if (resp.ok) {
        let ret = co.yield(resp.json());
        if (ret.errcode) {
            throw {message: ret.errmsg, errno: ret.errcode}
        }
    } else {
        throw {message: 'errno ' + resp.status, errno: resp.status}
    }
}

let cachedTicket = {expires: 0};

export function getJsConfig(name, url) {
    let now = Date.now();
    let receiver = receivers[name];

    if (cachedTicket.expires < now) {
        console.log('acquire new ticket');
        let access_token = getClientAccessToken(name);
        let resp = co.yield(fetch(`https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=${access_token}&type=jsapi`));
        if (resp.ok) {
            let ret = co.yield(resp.json());
            if (ret.errcode) {
                throw {message: ret.errmsg, errno: ret.errcode}
            }
            cachedTicket = {
                ticket: ret.ticket,
                expires: now + ret.expires_in * 1000 - 3000
            };
        } else {
            throw {message: 'errno ' + resp.status, errno: resp.status}
        }
    }


    let ts = now / 1000 | 0;
    let nonceStr = Math.random().toString(36).substr(2, 6);
    let signStr = `jsapi_ticket=${cachedTicket.ticket}&noncestr=${nonceStr}&timestamp=${ts}&url=${url}`;
    console.log('jsapi sign', signStr);
    let signature = sha1(signStr, 'hex');

    return {
        appId: receiver.appid,
        timestamp: ts,
        nonceStr: nonceStr,
        signature: signature,
        jsApiList: ['chooseWXPay']
    }
}

function pay_signature(xml, mch_key) {
    let strs = [];

    for (let key in xml) {
        let text = xml[key].TEXT;
        if (text) {
            strs.push(`${key}=${text}`)
        }
    }

    const signStr = strs.sort().join('&') + '&key=' + mch_key;
    console.log('sign', signStr);
    return md5(new Buffer(signStr), 'hex').toUpperCase();
}

export function getJsPayConfig(name, openid, remote_ip, order_id, body, price, notify_url) {
    //console.log('getJsPayConfig', arguments);

    let receiver = receivers[name];

    let nonceStr = Math.random().toString(36).substr(2, 6);
    let params = {
        appid: {TEXT: receiver.appid},
        body: {TEXT: body, CDATA: true},
        device_info: {TEXT: 'WEB'},
        mch_id: {TEXT: receiver.mch_id},
        nonce_str: {TEXT: nonceStr},
        notify_url: {TEXT: notify_url},
        openid: {TEXT: openid},
        out_trade_no: {TEXT: order_id},
        spbill_create_ip: {TEXT: remote_ip},
        total_fee: {TEXT: (price * 100 | 0)},
        trade_type: {TEXT: 'JSAPI'}
    };

    let signature = pay_signature(params, receiver.mch_key);

    params.sign = {TEXT: signature};

    let payload = build(params);
    let resp = co.yield(fetch(`https://api.mch.weixin.qq.com/pay/unifiedorder`, {
        method: 'POST',
        body: payload
    }));

    let respData = getPayResult(name, resp);

    let now = Date.now();
    let ts = now / 1000 | 0;
    let signStr = `appId=${receiver.appid}&nonceStr=${nonceStr}&package=prepay_id=${respData.prepay_id.TEXT}&signType=MD5&timeStamp=${ts}&key=${receiver.mch_key}`;
    info(`created js pay config: order:${order_id} price:${price} ip:${remote_ip} openid:${openid}`);
    return {
        timestamp: ts, // 支付签名时间戳，注意微信jssdk中的所有使用timestamp字段均为小写。但最新版的支付后台生成签名使用的timeStamp字段名需大写其中的S字符
        nonceStr: nonceStr, // 支付签名随机串，不长于 32 位
        'package': 'prepay_id=' + respData.prepay_id.TEXT, // 统一支付接口返回的prepay_id参数值，提交格式如：prepay_id=***）
        signType: 'MD5', // 签名方式，默认为'SHA1'，使用新版支付需传入'MD5'
        paySign: md5(signStr, 'hex').toUpperCase() // 支付签名
    }
}

export function getPayResult(name, body) {
    let receiver = receivers[name];

    let respData = parse(co.yield(body.text()));
    if (respData.return_code.TEXT !== 'SUCCESS') {
        throw new Error(respData.return_msg.TEXT)
    } else if (respData.result_code.TEXT !== 'SUCCESS') {
        warn('getPayResult bad result_code:' + respData.result_code.TEXT, respData.err_code_des.TEXT);
        throw new Error(respData.err_code_des.TEXT)
    }

    let signature = respData.sign.TEXT;
    delete respData.sign;
    let ret_sign = pay_signature(respData, receiver.mch_key);

    if (signature !== ret_sign) {
        throw new Error('signature does not match')
    }

    return respData;
}
