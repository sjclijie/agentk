"use strict";

const cp = require('child_process'),
    fs = require('fs'),
    path = require('path');

function watch(dir, cb) {
    fs.watch(dir, cb);

    for (let name of fs.readdirSync(dir)) {
        let subpath = path.join(dir, name);
        if (fs.statSync(subpath).isDirectory()) {
            watch(subpath, cb);
        }
    }
}

exports.run = function (dir) {
    let srcDir;
    if (dir.substr(-5) === '.json') {
        srcDir = path.resolve(dir, '../src');
    } else {
        srcDir = path.resolve(dir, 'src');
    }
    console.log('watching ' + srcDir);

    let worker, respawning, lastRespawn = Date.now();
    spawn();

    watch(srcDir, function onevent() {
        if (respawning) return;
        respawning = true;
        if (Date.now() - lastRespawn < 1000) {
            setTimeout(respawn, 1000);
        } else {
            setTimeout(respawn, 10);
        }
    });


    function respawn() {
        respawning = false;
        worker.kill('SIGINT');
        lastRespawn = Date.now();
        spawn();
    }

    function spawn() {
        worker = cp.spawn(
            process.execPath,
            ['--harmony', path.resolve(__dirname, '../index.js'), 'run', dir], {
                stdio: 'inherit'
            }
        );
    }
};
