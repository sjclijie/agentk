/**
 * @title Wrapper for child process
 */

const cp = require('child_process');
const fs = require('fs');

let ids = 0;

/**
 * Creates a new Node.JS process and runs the specific node module. See: [child\_process.fork](https://nodejs.org/api/child_process.html#child_process_child_process_fork_modulepath_args_options)
 * for more information about process creation.
 *
 * @param {string} module bootstrap module path (filename or directory with a `package.json` present)
 * @param {object} [options] optional arguments
 *
 *   - options.stdout: stdout file path to be forwarded
 *   - options.stderr: stderr file path to be forwarded
 *   - options.ipc: create a ipc channel (which enables `child_process.send` and `process.send`)
 *   - options.detached: child process is a new process group
 *   - options.uid: setuid
 *   - options.gid: setgid
 *   - options.env: environment variables
 *
 * @returns {node.child_process::ChildProcess}
 */
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
