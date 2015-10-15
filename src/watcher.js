"use strict";

const cp = require('child_process'),
    fs = require('fs'),
    path = require('path');

exports.run = function (dir) {
    let srcDir = path.resolve(dir, 'src');
    console.log('watching ' + srcDir);

    let worker, respawning, lastRespawn = Date.now();
    spawn();
    watch(srcDir);

    function onevent() {
        if (respawning) return;
        respawning = true;
        if (Date.now() - lastRespawn < 1000) {
            setTimeout(respawn, 1000);
        } else {
            setTimeout(respawn, 10);
        }
    }

    function watch(dir) {
        fs.watch(dir, onevent);
        for (let name of fs.readdirSync(dir)) {
            let childFile = path.join(dir, name);
            if (fs.statSync(childFile).isDirectory()) {
                watch(childFile)
            }
        }
    }

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
