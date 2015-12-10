const _net = require('net');

export let host = '127.0.0.1';
export let port = 25;

export function encode(str) {
    return '=?utf-8?b?' + new Buffer(str).toString('base64') + '?=';
}

export function send(mail) {
    let packet = 'MAIL FROM: ' + mail.from + '\r\n' +
        'RCPT TO: ' + mail.to + '\r\n' +
        'DATA\r\n' +
        'From: ' + (mail.from_user ? encode(mail.from_user) + ' <' + mail.from + '>' : mail.from) + '\r\n' +
        'To:' + mail.to + '\r\n' +
        'Subject:' + mail.subject + '\r\n' +
        mail.data + '\r\n.\r\nQUIT\r\n';

    return new Promise(function (resolve, reject) {
        _net.connect({host, port}).on('error', reject).on('close', resolve).end(packet);
    })
}

export function html(html) {
    return 'Mime-Version: 1.0;\r\n' +
        'Content-Type: text/html; charset="utf-8";\r\n' +
        'Content-Transfer-Encoding: base64;\r\n\r\n' +
        new Buffer(html).toString('base64')
}