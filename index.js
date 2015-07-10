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
    // read manifest
    let manifest = global.manifest = JSON.parse(require('fs').readFileSync(path.join(programDir, 'manifest.json'), 'utf8'));
    let main = path.resolve(programDir, manifest.main || 'index.js');
    console.log('run', main, manifest);
    let workdir = programDir;
    if (manifest.directory) {
        workdir = path.resolve(programDir, manifest.directory);
    }
    process.chdir(workdir);
    exports.load(main).done()
};

if (process.mainModule === module) {
    if (process.argv.length === 2) {
        throw new Error("full bootstrap file path is required")
    }
    let target = process.argv[2];

    if (target === 'start') {
        exports.run(process.argv[3])
    } else if (target.substr(target.length - 3) === '.js') {
        exports.load(require('path').resolve(target)).done();
    }
}
