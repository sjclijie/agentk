"use strict";

Promise.prototype.done = function () {
    this.then(null, function (err) {
        console.error('ERROR', err.stack || err.message || err);
        process.exit(1);
    })
};

require('./src/es6-module-loader');

exports.load = System.import;

exports.run = function (programDir) {
    let path = require('path');
    programDir = path.resolve(programDir);
    // read manifest
    let manifest = global.manifest = JSON.parse(require('fs').readFileSync(path.join(programDir, 'manifest.json'), 'utf8'));
    let main = path.resolve(programDir, manifest.main || 'index.js');
    // console.log('run', main, manifest);
    let workdir = programDir;
    if (manifest.directory) {
        workdir = path.resolve(programDir, manifest.directory);
    }
    process.chdir(workdir);

    let co = require('./src/co.js');
    if (manifest.action) {
        process.on('message', function (msg) {
            if (msg.action === 'trigger' && msg.cmd in manifest.action) {
                co.run(onAction, msg.cmd).done();
            }
        })
    }
    exports.load(main).done();
    function onAction(action) {
        co.yield(exports.load(path.resolve(programDir, manifest.action[action])))[action]();
    }
};

if (process.mainModule === module) {
    process.versions.agentk = require('./package.json').version;
    let target = process.argv[2], path = require('path').resolve(process.argv[3]);

    if (target === 'run') {
        process.env.NODE_UNIQUE_ID = '';
        require('cluster')._setupWorker();
        delete process.env.NODE_UNIQUE_ID;
        exports.run(path);
    } else if (target === 'load') {
        exports.load(path).done();
    }
}
