import * as http from "../module/http.js";
import * as response from "../module/http_response.js";
import * as file from '../module/file.js';
import {fork} from '../module/child_process.js'

const path = require('path');

const listen_path = 'daemon.sock';

console.log('starting service...');
if (file.exists(listen_path)) {
    file.rm(listen_path);
} else {
    file.mkParentDir(listen_path);
}

const programs = {};

const actions = {
    start: function (dir) {
        console.log('start', dir);
        if (dir in programs) throw new Error(`program '${dir}' already started`)
        return startProgram(dir)
    },
    status: function () {
        return Object.keys(programs).map(function (dir) {
            let program = programs[dir];
            return {
                path: dir,
                workers: program.workers.length,
                startup: program.startup,
                restarted: program.restarted,
                reloaded: program.reloaded,
                lastRestart: program.lastRestart,
                lastReload: program.lastReload,
            }
        })
    },
    stop: function (dir) {
        let program = getProgram(dir);

        // TODO kill program
        for (let worker of program.workers) {
            worker.kill();
        }

        delete programs[dir];

        return true;
    },
    restart: function (dir) {
        let program = getProgram(dir);

        // TODO restart program

        program.lastRestart = Date.now();
        program.restarted++;
        return true
    }
};

function getProgram(dir) {
    if (!(dir in programs)) {
        throw new Error(`program '${dir}' not started`)
    }
    return programs[dir];
}

let server = http.listen(listen_path, function (req) {
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


function startProgram(dir) {
    // try read manifest
    let manifest, main;
    try {
        manifest = JSON.parse('' + file.read(path.join(dir, 'manifest.json')));
    } catch (e) { // no manifest
        manifest = null;
        main = path.join(dir, 'index.js');
        if (!file.exists(main)) {
            throw new Error(`no manifest.json or index.js found in '${dir}'`)
        }
    }

    let option = {};
    if (manifest) {
        main = 'start';
        option.args = [dir];
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
    }

    let workers = [];

    programs[dir] = {
        workers: workers,
        startup: Date.now(),
        restarted: 0,
        reloaded: 0,
        lastReload: 0,
        lastRestart: 0
    }

    respawn(0);
    return true


    function respawn(i) {
        console.log('respawn', i, main, option);
        let worker = workers[i] = fork(main, option);
    }
}