"use strict";

module.exports = function (program) {
    if (program.stdout) {
        tail(program.stdout, '\x1b[32mout|\x1b[0m')
    }
    if (program.stderr) {
        tail(program.stderr, '\x1b[31merr|\x1b[0m');
    }
};

function tail(file, prefix) {
    let cp = require('child_process');
    let child = cp.spawn('tail', ['-20f', file], {
        stdio: 'pipe'
    });
    let remain = '', remain2 = '';
    child.stdout.on('data', function (data) {
        let arr = (remain + data).split('\n');
        remain = arr.pop();
        for (let i = 0, L = arr.length; i < L; i++) {
            process.stdout.write(prefix + arr[i] + '\n');
        }
    })
}