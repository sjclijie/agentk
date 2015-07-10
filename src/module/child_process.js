const cp = require('child_process');
const fs = require('fs');
const path = require('path');

export function fork(module, options) {
    options = options || {};
    const opts = {};
    if (options.directory) {
        opts.cwd = options.directory
    }
    if (options.stdout || options.stderr) {
        opts.stdio = [0,
            options.stdout ? fs.openSync(options.stdout, 'a') : 1,
            options.stderr ? fs.openSync(options.stderr, 'a') : 2
        ]
    }
    for (let param of ['detached', 'uid', 'gid']) {
        if (param in options) opts[param] = options[param]
    }
    let args = [path.join(__dirname, '../../index.js'), module];
    if (options.args) args = args.concat(options.args);

    return cp.spawn(process.execPath, process.execArgv.concat(args), opts)
}
