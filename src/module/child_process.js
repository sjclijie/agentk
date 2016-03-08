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
 *   - options.directory: working directory
 *   - options.stdout: stdout file path to be forwarded
 *   - options.stderr: stderr file path to be forwarded
 *   - options.ipc: create a ipc channel (which enables `child_process.send` and `process.send`)
 *   - options.detached: child process is a new process group
 *   - options.uid: setuid
 *   - options.gid: setgid
 *   - options.env: environment variables
 *   - options.args: extra arguments
 *
 * @returns {node.child_process::ChildProcess}
 */
export function fork(module, options = {}) {
    const opts = {};
    if (options.directory) {
        opts.cwd = options.directory
    }
    let outFd = 0, errFd = 0;

    opts.stdio = [0,
        options.stdout ? options.stdout === 'pipe' ? 'pipe' : outFd = fs.openSync(options.stdout, 'a') : 1,
        options.stderr ? options.stderr === 'pipe' ? 'pipe' : errFd = fs.openSync(options.stderr, 'a') : 2
    ];

    if (options.ipc) {
        opts.stdio.push('ipc');
    }
    for (let param of ['detached', 'uid', 'gid', 'env']) {
        if (param in options) opts[param] = options[param]
    }
    let args = process.execArgv.concat([module]);
    if (options.args) args = args.concat(options.args);

    let child = cp.spawn(process.execPath, args, opts);

    if (outFd) fs.closeSync(outFd);
    if (errFd) fs.closeSync(errFd);
    return child;
}

/**
 * Runs a shell command and returns its output, throws if command failed
 *
 * @param {string} cmd command string to be executed
 * @param {object} [options] optional arguments
 *
 *   - options.uid: setuid
 *   - options.gid: setgid
 *   - options.env: environment variables
 *
 * @returns {Array} `[stdout, stderr]`
 */
export function exec(cmd, options = {}) {
    const opts = {};
    if (options.directory) {
        opts.cwd = options.directory
    }
    for (let param of ['uid', 'gid', 'env']) {
        if (param in options) opts[param] = options[param]
    }
    return co.promise(function (resolve, reject) {
        cp.exec(cmd, opts, function (err, stdout, stderr) {
            if (err) reject(err);
            else resolve([stdout, stderr])
        })
    });
}