"use strict";

const cp = require('child_process'),
    fs = require('fs'),
    path = require('path');

exports.run = function (dir) {
    let srcDir = path.resolve(dir, 'src');
    console.log('watching ' + srcDir);

    let worker, respawning;
    spawn();

    fs.watch(srcDir, function () {
        if (respawning) return;
        respawning = true;
        setTimeout(function () {
            respawning = false;
            worker.kill('SIGINT');
            spawn();
        })
    });

    function spawn() {
        worker = cp.spawn(process.execPath, ['--harmony', path.resolve(__dirname, '../bin/agentk.js'), 'run', dir], {
            stdio: 'inherit'
        })
    }
};
