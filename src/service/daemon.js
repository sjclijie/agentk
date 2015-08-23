import * as http from "../module/http.js";
import * as response from "../module/http_response.js";
import * as file from '../module/file.js';
import {fork} from '../module/child_process.js';
import * as scheduler from 'scheduler.js';
import * as channel from '../module/channel.js';

const path = require('path');

let server, listen_path = 'daemon.sock', win32 = process.platform === 'win32';
const main = process.argv[1];

if (file.exists(listen_path)) file.rm(listen_path);

const programs = {};

const actions = {
    alive: function () {
        return true
    },
    exit: function () {
        server.close();
        if (!win32) try {
            file.rm(listen_path)
        } catch (e) {
            console.error('failed cleaning up: ' + e.message);
        }
        setTimeout(process.exit, 200);
        return true
    },
    start: function (dir) {
        console.log('start', dir);
        if (dir in programs) throw new Error(`program '${dir}' already started`);
        return startProgram(dir)
    },
    status: function (dirs) {
        return (dirs || Object.keys(programs)).map(function (dir) {
            let program = getProgram(dir);
            return {
                path: dir,
                workers: program.workers.length,
                startup: program.startup,
                restarted: program.restarted,
                reloaded: program.reloaded,
                lastRestart: program.lastRestart,
                lastReload: program.lastReload
            }
        })
    },
    stop: function (dir) {
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
    restart: function (dir) {
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
    reload: function (dir) {
        // TODO reload support
        return actions.restart(dir)
    }
};

resumeJobs();

console.log('starting service...');
server = http.listen(win32 ? 32761 : listen_path, function (req) {
    console.log(req.method, req.url);
    let action = req.url.substr(1);
    if (!(action in actions)) {
        return response.error(404, 'command not found: ' + action)
    }
    let data;
    if ('data' in req.headers) {
        data = JSON.parse(req.headers.data);
    } else {
        data = null
    }
    try {
        return response.json(actions[action](data));
    } catch (e) {
        console.error(e.stack || e);
        return response.error(500, e.message)
    }
});

console.log('service started at', server.address());
if (win32) {
    file.close(file.open(listen_path, 'w'));
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
            console.log('resuming ' + program.dir);
            try {
                startProgram(program.dir);
            } catch(e) {
                console.error('program %s resume failed: %s', program.dir, e.message);
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
    let arr = Object.keys(programs).map(function (dir) {
        let program = programs[dir];
        return {
            dir: dir,
            stdout: program.stdout,
            stderr: program.stderr
        }
    });
    file.write('programs', JSON.stringify(arr));
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

    if (manifest) {
        option.args.push('run', dir);
        let workDir = dir;
        if (manifest.directory) {
            workDir = path.resolve(workDir, manifest.directory)
        }
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
    }


    let workers = [], restarted = [];

    let program = programs[dir] = {
        stdout: option.stdout || null,
        stderr: option.stderr || null,
        workers: workers,
        startup: Date.now(),
        restarted: restarted,
        reloaded: 0,
        lastReload: 0,
        lastRestart: 0,
        stopped: false,
        schedulers: {}
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
            console.log(`${formatTime(now)} - ${dir}: respawn worker ${i}`);
            restarted[i]++;
            program.lastRestart = Date.now();
            let worker = workers[i] = fork(main, option);
            worker.program = program;
            worker.on('exit', onExit);
            scheduler.onWorker(worker);
            channel.onWorker(worker);

        }
    }
}

function formatTime(t) {
    let time = new Date(t);
    return `${time.getFullYear()}-${tens(time.getMonth() + 1)}-${tens(time.getDate())} ${time.toTimeString().substr(0, 8)}`
}

function tens(num) {
    return (num < 10 ? '0' : '') + num;
}
