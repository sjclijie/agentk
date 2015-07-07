"use strict";

Promise.prototype.done = function() {
    this.then(null, function(err) {
        console.error('ERROR', err.stack || err.message || err);
        process.exit(1);
    })
}

require('./src/es6-module-loader');

exports.load = System.import;

exports.run = function () {
    const programDir = process.cwd();
    // read manifest
    let manifest = global.manifest = JSON.parse(require('fs').readFileSync('manifest.json', 'utf8'));

    if ('directory' in manifest && manifest.directory) {
        let workdir = manifest.directory;
        if (workdir[0] !== '/') {
            workdir = require('path').join(programDir, workdir);
        }
        process.chdir(workdir);
    }
	exports.load(require('path').join(programDir, manifest.main || 'index.js')).done()
};

