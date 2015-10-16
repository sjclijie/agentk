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
import {sha1,cipheriv,decipheriv} from 'crypto';
import {fetch,Response} from 'http';

const receivers = {}; // name => Receiver
const users = {}; // userid => Receiver

const CLIENT_ERROR = Response.error(403);

class WechatMessageReceiver {
    constructor(userid, appid, secret, encodingKey) {

        this.userid = userid;
        this.appid = appid;
        this.secret = secret;
        if (encodingKey) {
            const aesKey = new Buffer(encodingKey + '=', 'base64'), aesIV = aesKey.slice(0, 16);
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

export function addMessageReceiver(name, userid, appid, secret, encodingKey) {
    receivers[name] = users[userid] = new WechatMessageReceiver(userid, appid, secret, encodingKey);
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