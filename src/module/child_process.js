const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const uitl = require('util');

let ids = 0;

export function fork(module, options) {
    options = options || {};
    const opts = {};
    if (options.directory) {
        opts.cwd = options.directory
    }
    opts.stdio = [0,
        options.stdout ? fs.openSync(options.stdout, 'a') : 1,
        options.stderr ? fs.openSync(options.stderr, 'a') : 2
    ];

    if (options.ipc) {
        opts.stdio.push('ipc');
    }
    for (let param of ['detached', 'uid', 'gid', 'env']) {
        if (param in options) opts[param] = options[param]
    }
    let args = process.execArgv.concat([module]);
    if (options.args) args = args.concat(options.args);

    return cp.spawn(process.execPath, args, opts);
}
