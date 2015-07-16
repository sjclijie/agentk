"use strict";

let fs = require('fs'),
    path = require('path'),
    cp = require('child_process');

if (fs.readdirSync('.').length) {
    console.error('directory not empty, exiting...');
}

if (process.platform === 'win32' && false) {

} else {
    cp.execSync('cp -R ' + path.join(__dirname, '../demo') + '/* .', {
        stdio: 'inherit'
    });
}
console.log('file copied');
let dependencies = JSON.parse(fs.readFileSync('package.json', 'utf8')).dependencies;
if (dependencies) {
    console.log('This project requires some other packages, run `npm install .` to install the dependencies');
}

console.log('\nProject has been generated, run `ak run` and visit http://localhost:' + JSON.parse(fs.readFileSync('manifest.json')).config.port);