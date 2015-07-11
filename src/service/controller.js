import * as http from '../module/http.js';
import * as file from '../module/file.js';
import {fork} from '../module/child_process.js';

const path = require('path');

const win32 = process.platform === 'win32';
const listen_path = path.join(process.env.HOME, '.agentk/daemon.sock');

const dir = win32 ? process.cwd().replace(/\\/g, '/').toLowerCase() : process.cwd();

export function start() {
    getData(tryCallService('start', dir));
}

export function stop() {
    getData(callService('stop', dir))
}

export function reload() {
    getData(callService('reload', dir))
}

export function restart() {
    getData(callService('restart', dir))
}

export function svc_start() {
    getData(tryCallService('alive'));
}

export function svc_stop() {
    try {
        callService('exit');
    } catch (e) {
        if (e.code === 'ECONNREFUSED' || e.code === 'ENOENT') {
            console.log('service not started');
            return;
        }
        throw e;
    }
    console.log('done');
}

function getData(result) {
    if (result.code !== 200) {
        throw new Error(result.msg)
    }
    return JSON.parse(result.msg)
}

export function status() {
    let data = getData(callService('status'))

    if (!data.length) {
        console.log('no program is currently running');
        return;
    }

    let buf1 = '   Programs ',
        buf2 = ' |\n------------',
        buf8 = '-|\n\x1b[36m     workers\x1b[0m',
        buf3 = ' |\n\x1b[36m  start time\x1b[0m',
        buf4 = ' |\n\x1b[36m   restarted\x1b[0m',
        buf5 = ' |\n\x1b[36mlast restart\x1b[0m',
        buf6 = ' |\n\x1b[36m    reloaded\x1b[0m',
        buf7 = ' |\n\x1b[36m last reload\x1b[0m';

    let maxNameLines = 1, nameLines = [];

    for (let i = 0, L = data.length; i < L; i++) {
        let obj = data[i],
            path = obj.path,
            width,
            pathLines = 1;

        if (path.length < 20) {
            path += '                    '.substr(path.length);
        } else if (path.length > 20) {
            pathLines = (path.length + 19) / 20 | 0;
            path += '                    '.substr(0, pathLines * 20 - path.length);
            if(pathLines > maxNameLines) {
                do {
                    nameLines[maxNameLines++] = '            ' + ' |                     '.repeat(i)
                } while(maxNameLines < pathLines);
            }
        }
        let suffix = '                    ';
        console.log(obj.path, obj.path.length, path.length, pathLines);
        if(pathLines === 1) {
            buf1 += ' | \x1b[32m' + path + '\x1b[0m';
        } else {
            buf1 += ' | \x1b[32m' + path.substr(0, 20) + '\x1b[0m';
            for(let j = 1; j < pathLines; j++) {
                nameLines[j] += ' | \x1b[32m' + path.substr(j * 20, 20) + '\x1b[0m';
            }
        }
        buf2 += '-|---------------------';
        buf8 += append(obj.workers, suffix);
        buf3 += append(formatTime(obj.startup), suffix);
        buf4 += append(obj.restarted, suffix);
        buf5 += append(formatTime(obj.lastRestart), suffix);
        buf6 += append(obj.reloaded, suffix);
        buf7 += obj.reloaded ? append(formatTime(obj.lastReload), suffix) : ' | ' + suffix;
    }
    for(let i = 1; i < maxNameLines; i++) {
        buf1 += ' |\n' + nameLines[i];
    }
    console.log(buf1 + buf2 + buf8 + buf3 + buf4 + buf5 + buf6 + buf7 + ' |');


    function formatTime(t) {
        let time = new Date(t);
        return `${time.getFullYear()}-${tens(time.getMonth() + 1)}-${tens(time.getDate())} ${time.toTimeString().substr(0, 8)}`
    }

    function tens(num) {
        return (num < 10 ? '0' : '') + num;
    }

    function append(str, suffix) {
        str = '' + str;
        return ' | ' + str + suffix.substr(str.length)
    }
}

function callService(name, data) {
    let headers = {
        'Content-Length': '0'
    };
    if (data) {
        headers.data = JSON.stringify(data)
    }
    let options = {
        method: 'GET',
        path: '/' + name,
        headers: headers
    };
    if (win32) {
        options.host = '127.0.0.1';
        options.port = 32761;
    } else {
        options.socketPath = listen_path;
    }
    let resp = http.request(options);

    return {code: resp.statusCode, msg: '' + http.read(resp)}
}

function tryCallService(name, data) {
    if (!win32 && !file.exists(listen_path)) {
        console.error('starting service...');
        return forkAndCall(name, data);
    }
    try {
        return callService(name, data);
    } catch (e) {
        if (e.code === 'ECONNREFUSED' || e.code === 'ENOENT') {
            console.error('service not started, restarting...');
            win32 || file.rm(listen_path);
            return forkAndCall(name, data); // retry
        }
        return {code: -1, msg: e.message}
    }
}

function forkAndCall(name, data) {
    file.mkParentDir(listen_path);
    let service_dir = path.dirname(listen_path),
        stdout = path.join(service_dir, 'out.log'),
        stderr = path.join(service_dir, 'err.log');

    fork(path.join(__dirname, 'daemon.js'), {
        directory: service_dir,
        stdout: stdout,
        stderr: stderr,
        detached: true
    }).unref();

    co.sleep(300);
    return callService(name, data);
}

