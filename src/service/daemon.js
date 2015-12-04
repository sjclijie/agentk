import * as http from "../module/http";
import * as file from '../module/file';
import {fork} from '../module/child_process';
import * as scheduler from 'scheduler';
import * as channel from '../module/channel';

const path = require('path');

const timeOff = new Date().getTimezoneOffset() * 60e3;

let server, listen_path = 'daemon.sock', win32 = process.platform === 'win32';
const main = process.argv[1];

if (file.exists(listen_path)) file.rm(listen_path);

const programs = {};

const actions = {
    alive() {
        return true
    },
    exit() {
        server.close();
        if (!win32) try {
            file.rm(listen_path)
        } catch (e) {
            console.error('failed cleaning up: ' + e.message);
        }
        setTimeout(process.exit, 200);
        return true
    },
    start(dir) {
        if (dir in programs) throw new Error(`program '${dir}' already started`);
        return startProgram(dir)
    },
    status(dirs) {
        return (dirs || Object.keys(programs)).map(dir => {
            let program = getProgram(dir);
            return {
                path: dir,
                workers: program.workers.length,
                startup: program.startup,
                restarted: program.restarted,
                reloaded: program.reloaded,
                lastRestart: program.lastRestart,
                lastReload: program.lastReload,
                schedulers: Object.keys(program.schedulers)
            }
        })
    },
    stop(dir) {
        let program = getProgram(dir);
        program.stopped = true;
        delete programs[dir];
        updateLog();

        for (let worker of program.workers) {
            if (!worker) continue;

            try {
                worker.kill();
            } catch (e) {
            }
        }


        return true;
    },
    restart(dir) {
        let program = getProgram(dir);

        for (let worker of program.workers) {
            if (!worker) continue;

            try {
                worker.kill();
            } catch (e) {
            }
        }
        return true
    },
    reload(dir) {
        return actions.restart(dir)
    }
};

const modules = Object.create(null);
modules.daemon = trigger;

resumeJobs();

server = http.listen(win32 ? 32761 : listen_path, onServiceRequest);
console.log(`${formatTime(Date.now())} daemon.js: service started at`, server.address());
if (win32) {
    file.close(file.open(listen_path, 'w'));
}

function startProgram(dir) {
    // try read manifest
    let manifest, workerCount = 1;
    let option = {
        args: [],
        ipc: true,
        detached: true
    };
    try {
        manifest = JSON.parse('' + file.read(path.join(dir, 'manifest.json')));
    } catch (e) { // no manifest
        // console.error(e.stack);
        manifest = null;
        let module = path.join(dir, 'index.js');
        if (!file.exists(module)) {
            throw new Error(`no manifest.json or index.js found in '${dir}'`)
        }
        option.args.push('load', module);
    }

    let workDir;

    if (manifest) {
        option.args.push('run', dir);
        workDir = dir;
        if (manifest.directory) {
            workDir = path.resolve(workDir, manifest.directory)
        }
        option.directory = workDir;
        if ('stdout' in manifest) {
            option.stdout = path.resolve(workDir, manifest.stdout);
            file.mkParentDir(option.stdout);
        }
        if ('stderr' in manifest) {
            option.stderr = path.resolve(workDir, manifest.stderr);
            file.mkParentDir(option.stderr);
        }
        if ('workers' in manifest) {
            workerCount = +manifest.workers;
        }
    } else {
        workDir = path.dirname(dir)
    }


    let workers = [], restarted = [];

    let program = programs[dir] = {
        stdout: option.stdout || null,
        stderr: option.stderr || null,
        directory: workDir,
        workers,
        startup: Date.now(),
        restarted,
        reloaded: 0,
        lastReload: 0,
        lastRestart: 0,
        stopped: false,
        schedulers: {},
        action: manifest && manifest.action
    };
    updateLog();

    for (let i = 0; i < workerCount; i++) {
        restarted[i] = -1;
        respawn(i);
    }
    return true;


    function respawn(i) {
        let lastRespawn = 0, fastRespawn = 0;
        onExit();

        function onExit() {
            if (program.stopped) return;
            let now = Date.now();
            if (now - lastRespawn < 3000) {
                fastRespawn++;
                if (fastRespawn === 3) {
                    console.error(`${formatTime(now)} - ${dir}: respawn too fast, disabled for 10 secs`);
                    workers[i] = null;
                    setTimeout(onExit, 10e3);
                    return;
                }
            } else {
                lastRespawn = now;
                fastRespawn = 0;
            }
            console.log(`${formatTime(now)} daemon.js::respawn: program[${dir}] worker[${i}]`);
            restarted[i]++;
            program.lastRestart = Date.now();
            let worker = workers[i] = fork(main, option);
            worker.program = program;
            worker.on('exit', onExit);
            worker.on('message', onMessage);
            scheduler.onWorker(worker);
        }
    }
}

function resumeJobs() {
// resume jobs
    if (file.exists('programs')) {
        let programs;
        try {
            programs = JSON.parse('' + file.read('programs'));
        } catch (e) {
            return
        }
        for (let program of programs) {
            console.log(`${formatTime(Date.now())} daemon.js::resume: program[${program.dir}]`);
            try {
                startProgram(program.dir);
            } catch (e) {
                console.error(`${formatTime(Date.now())} daemon.js::resume: failed program[${program.dir}] message[${e.message}]`);
            }
        }
        updateLog()
    }
}

function getProgram(dir) {
    if (!(dir in programs)) {
        throw new Error(`program '${dir}' not started`)
    }
    return programs[dir];
}

function updateLog() {
    let arr = Object.keys(programs).map(dir => {
        let program = programs[dir];
        return {
            dir: dir,
            stdout: program.stdout,
            stderr: program.stderr
        }
    });
    file.write('programs', JSON.stringify(arr));
}

function formatTime(t) {
    const dt = new Date(t - timeOff).toJSON();
    return dt.substr(0, 10) + ' ' + dt.substr(11, 8);
}

function tens(num) {
    return (num < 10 ? '0' : '') + num;
}

function onServiceRequest(req) {
    console.log(`${formatTime(Date.now())} daemon.js: ${req.method} ${req.url}`);
    let action = req.url.substr(req.url.indexOf('?') + 1);

    let data = req.headers.get('data');

    try {
        return http.Response.json(trigger({cmd: action, data: data && JSON.parse(data)}));
    } catch (e) {
        console.error(`${formatTime(Date.now())} daemon.js: request handling failed cmd[${action}] message[${e.message || e}]`);
        return http.Response.error(500, e.message)
    }
}

function onMessage(msg) {
    if (!msg || !msg.action) return;
    let worker = this;
    co.run(function () {
        if (msg.action === 'setup') { // setup module
            let module = msg.module;
            if (module in modules) return;
            let method = co.yield(include('../module/' + module, __dirname)).onMessage;
            if (typeof method === 'function') modules[module] = method;
            return;
        }
        if (msg.action in modules) {
            let ret, seq = msg.seq;
            try {
                ret = {state: 0, data: modules[msg.action].call(worker, msg)};
            } catch (e) {
                ret = {state: 1, message: e.message || e}
            }
            if (seq) {
                ret.ack = seq;
                try {
                    worker.send(ret)
                } catch (e) {
                    console.error(`${formatTime(Date.now())} daemon.js::onMessage: send ack failed, silent ignoring message[${e.message}]`);
                }
            }
        }
    });
}

function trigger(msg) {
    let action = msg.cmd, data = msg.data;
    if (typeof data === 'string' && data in programs) {
        let program = programs[data];
        if (program.action && action in program.action) {
            // trigger action
            msg = {action: 'trigger', cmd: action};
            for (let worker of program.workers) {
                try {
                    worker.send(msg)
                } catch (e) {
                    console.error(`${formatTime(Date.now())} daemon.js::trigger: send action to worker failed, silent ignoring worker[${worker.pid}] message[${e.message}]`);
                }
            }
            return true;
        }
    }
    if (!(action in actions)) {
        throw new Error('command not found: ' + action);
    }
    return actions[action](data);
}