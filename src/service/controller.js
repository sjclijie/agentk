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

export function service_start() {
    let alive = getData(tryCallService('alive'));
    if (alive !== true) {
        throw new Error('start failed');
    }
}

export function service_stop() {
    callService('exit');
}

export function service_upstart_install(uname) {
    const filename = `/etc/init/ak_${uname}.conf`;
    if (file.exists(filename)) {
        throw new Error(`${uname}: service already installed`);
    }

    let dir = path.dirname(__dirname);
    file.write(filename, `description "AgentK: Integrated Node.JS Framework"

start on filesystem and static-network-up
stop on runlevel [016]

respawn

script
    exec /bin/su ${uname} << EOC
        cd
        mkdir -p .agentk
        cd .agentk
        exec ${process.execPath} --harmony "${dir}/index.js" load "${dir}/src/service/daemon.js" >> out.log 2>> err.log
    EOC
end script`);

    console.log(`${uname}: service installed, use \x1b[36msudo initctl start ak_${uname}\x1b[0m to start the service`);
}

export function service_upstart_uninst(uname) {
    const filename = `/etc/init/ak_${uname}.conf`;
    if (!file.exists(filename)) {
        throw new Error(`${uname}: service not installed`);
    }
    file.rm(filename);
}

function getData(result) {
    if (result.code !== 200) {
        throw new Error(result.msg)
    }
    return JSON.parse(result.msg)
}

export function description() {
    console.log(`\x1b[32mak service <command>\x1b[0m controls service status or installs/uninstalls service from operating system. A\
 \x1b[33mservice\x1b[0m is a background process that runs and controls the user program, restarts it when it has exited\
 unexpectedly.

\x1b[36mSYNPOSIS\x1b[0m

  ak service start
  ak service stop
  ak service upstart_install [username]
  ak service upstart_uninst [username]

\x1b[36mDESCRIPTION\x1b[0m

  \x1b[32mak service start\x1b[0m: starts the service if it has not ben started.
    If there are running user programs when the service is stopped or killed, they will be respawned. Command \x1b[32mak start <program>\x1b[0m will also restart the service if it has not been started.

  \x1b[32mak service stop\x1b[0m: stops the service.
    All running programs will be killed, and will be respawned when the service starts again

  \x1b[32mak service upstart_install [username]\x1b[0m: installs daemon service into operating system's upstart scripts.
    Upstart is a event-driven service manager. You can run the next command to see if your system supports upstart:
        \x1b[36msudo initctl --version\x1b[0m

    A username should be supplied to run the service, otherwise \x1b[36m'root'\x1b[0m will be used.
    The daemon service will be automatically started when the computer finishes its boot, and respawned if killed unexpectedly.
    To make the installation to take effect immediately, run \x1b[36msudo initctl start ak_[username]\x1b[0m

  \x1b[32mak service upstart_install [username]\x1b[0m: removes the upstart service installation.
    PLEASE DO stop the service before it is uninstalled, run \x1b[36msudo initctl status ak_[username]\x1b[0m to check whether
the service is stopped, run \x1b[36msudo initctl stop ak_[username]\x1b[0m to stop the service`);
}

export function status() {
    let data = getData(callService('status'));

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
            if (pathLines > maxNameLines) {
                do {
                    nameLines[maxNameLines++] = '            ' + ' |                     '.repeat(i)
                } while (maxNameLines < pathLines);
            }
        }
        let suffix = '                    ';
        if (pathLines === 1) {
            buf1 += ' | \x1b[32m' + path + '\x1b[0m';
        } else {
            buf1 += ' | \x1b[32m' + path.substr(0, 20) + '\x1b[0m';
            for (let j = 1; j < pathLines; j++) {
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
    for (let i = 1; i < maxNameLines; i++) {
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

    fork(path.join(__dirname, '../../index.js'), {
        args: ['load', path.join(__dirname, 'daemon.js')],
        directory: service_dir,
        stdout: stdout,
        stderr: stderr,
        detached: true
    }).unref();
    do {
        co.sleep(10);
    } while (!file.exists(listen_path));

    return callService(name, data);
}

