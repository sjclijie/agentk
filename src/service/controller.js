import * as http from '../module/http.js';
import * as file from '../module/file.js';
import {fork} from '../module/child_process.js';

const path = require('path');

const listen_path = path.join(process.env.HOME, '.agentk/daemon.sock');

export function start() {
    getData(tryCallService('start', process.cwd()));
}

export function stop() {
    getData(callService('stop', process.cwd()))
}

export function restart() {
    getData(callService('restart', process.cwd()))
}

function getData(result) {
    if(result.code !== 200) {
        throw new Error(result.msg)
    }
    return JSON.parse(result.msg)
}

export function status() {
    let data = getData(callService('status'))

    if(!data.length) {
        console.log('no program is currently running');
    }

    let buf1 = '   Programs ',
        buf2 = ' |\n------------',
        buf3 = '-|\n\x1b[36m  start time\x1b[0m',
        buf4 = ' |\n\x1b[36m   restarted\x1b[0m',
        buf5 = ' |\n\x1b[36mlast restart\x1b[0m',
        buf6 = ' |\n\x1b[36m    reloaded\x1b[0m',
        buf7 = ' |\n\x1b[36m last reload\x1b[0m';

    for(let obj of data) {
        let pathLen = obj.path.length;
        if(pathLen < 19) {
            pathLen = 19
        }
        let suffix = ' '.repeat(pathLen);
        buf1 += ' | \x1b[32m' + obj.path + '\x1b[0m' + suffix.substr(obj.path.length);
        buf2 += '-|-' + '-'.repeat(pathLen);
        buf3 += append(formatTime(obj.startup), suffix);
        buf4 += append(obj.restarted, suffix);
        buf5 += obj.restarted ? append(formatTime(obj.lastRestart), suffix): ' | ' + suffix;
        buf6 += append(obj.reloaded, suffix);
        buf7 += obj.reloaded ? append(formatTime(obj.lastReload), suffix): ' | ' + suffix;
    }
    console.log(buf1 + buf2 + buf3 + buf4 + buf5 + buf6 + buf7 + ' |');


    function formatTime(t) {
        let time = new Date(t);
        return `${time.getFullYear()}-${tens(time.getMonth() + 1)}-${tens(time.getDate())} ${time.toTimeString().substr(0,8)}`
    }

    function tens(num) {
        return (num < 10 ? '0' : '') + num;
    }

    function append(str, suffix) {
        str = '' + str;
        return ' | ' + str + suffix.substr(str.length)
    }
}


export function startService() {
    tryCallService('alive')
}

function callService(name, data) {
    let headers = {
        'Content-Length': '0'
    }
    if(data) {
        headers.data = JSON.stringify(data)
    }
    let resp = http.request({
        method: 'GET',
        socketPath: listen_path,
        path: '/' + name,
        headers: headers
    });

    return {code: resp.statusCode, msg: '' + http.read(resp)}
}

function tryCallService(name, data) {
    if(!file.exists(listen_path)) {
        console.error('starting service...');
        return forkAndCall(name, data);
    }
    try {
        return callService(name, data);
    } catch (e) {
        if(e.code === 'ECONNREFUSED') {
            console.error('service not started, restarting...');
            file.rm(listen_path);
            return forkAndCall(name, data); // retry
        }
        return {code: -1, msg: e.message}
    }
}

function forkAndCall(name, data) {
    file.mkParentDir(listen_path);
    let service_dir = path.dirname(listen_path),
        stdout = path.join(service_dir, 'out.log'),
        stderr = path.join(service_dir, 'err.log')

    fork(path.join(__dirname, 'daemon.js'), {
        directory: service_dir,
        stdout: stdout,
        stderr: stderr,
        detached: true
    }).unref();

    co.sleep(300);
    return callService(name, data);
}

