#!/bin/sh
":" // ; exec /usr/bin/env node --harmony "$0" "$@"
"use strict";

let exec = 'ak';

let min_version = 'v0.12.2';

if (process.version < min_version) {
    throw new Error(exec + " runs on Node.js " + min_version + " or higher, please upgrade your installation and try again.");
}

const cp = require('child_process'),
    fs = require('fs'),
    path = require('path');

const win32 = process.platform === 'win32';

let colors = {
    'k': '0',
    'K': '0;1',
    'r': '1',
    'R': '1;1',
    'g': '2',
    'G': '2;1',
    'y': '3',
    'Y': '3;1',
    'b': '4',
    'B': '4;1',
    'm': '5',
    'M': '5;1',
    'c': '6',
    'C': '6;1',
    'w': '7',
    'W': '7;1'
};

let cmd = process.argv[2];


function xtermEscape(str) {
    return str.replace(/\$#[rgbcmykw]{2}<(.+?)>/gi, function (m, text) {
        return '\x1b[3' + colors[m[2]] + ';4' + colors[m[3]] + 'm' + text + '\x1b[0m';
    });
}

function callService(cmd, options) {

    let co = require('../src/co.js'),
        load = require('../index.js').load;
    co.run(function () {
        let module = co.yield(load(path.join(__dirname, '../src/service/controller.js')));

        try {
            module[cmd.replace(' ', '_')](options);
        } catch (err) {
            if (err.code === 'ECONNREFUSED' || err.code === 'ENOENT') {
                console.error('command \'' + cmd + '\' failed, maybe service not started?')
            } else {
                console.error('command \'' + cmd + '\' failed, ' + err.message)
            }
            process.exit(-1)
        }
    }).done();
}

function commander(dir) {
    if (dir === '--all') {
        if (cmd === 'start') {
            console.error(exec + ' start --all is not supported');
            process.exit(-1);
        }
        cmd += 'All';
    } else if (dir !== undefined) {
        if (!require('fs').statSync(dir).isDirectory()) {
            console.error(exec + ' ' + cmd + ' requires directory name as parameter');
            process.exit(-1);
        }
        process.chdir(dir);
    }
    callService(cmd)
}

let commands = {
    "help": {
        help: "print this help message",
        "args": "[<command>]",
        maxArgs: 1,
        "desc": "display usage of commands",
        func: function (subcmd) {
            let cmd = process.argv[2];
            if (cmd === 'help' && arguments.length && subcmd in commands) { // help <cmd>
                let command = commands[subcmd];
                console.log(xtermEscape("$#Gk<usage>: $#Ck<" + exec + "> " + subcmd + " " + (command.args || "") + "\n"));
                let desc = 'desc' in command ? command.desc : command.help;
                desc && console.log(desc);
                return;
            } else if (!cmd || cmd === 'help' && !subcmd) { // agentk help?
                console.log(xtermEscape("$#Gk<usage>: $#Ck<" + exec + "> <command> [<args>]\n"));
            } else {
                if (cmd === 'help') { // agentk help xxx
                    cmd = subcmd
                }
                console.log(xtermEscape("command not found: $#Rk<" + cmd + ">\n"));
            }

            console.log(xtermEscape("possible commands are:"));
            Object.keys(commands).forEach(function (cmd) {
                console.log(xtermEscape("  $#yk<" + cmd + ">" + "            ".substr(cmd.length) + commands[cmd].help))
            });
            console.log(xtermEscape("\ntype $#Ck<" + exec + " help> <command> to get more info"));
        }, completion: function (prefix) {
            let output = '';
            for (let txt of Object.keys(commands)) {
                output = completion(output, prefix, txt);
            }
            return output;
        }
    },
    "run": {
        help: "run program without crash respawn",
        "args": "[<program directory> | <main module>]",
        "desc": "run the program located in the directory (or current directory, if none specified) directly in current " +
        "terminal, outputs will be printed into stdout/stderr.\nHit Ctrl-c to terminate execution",
        func: function (dir) {
            if (arguments.length === 0) {
                dir = '.'
            }
            if (dir.substr(dir.length - 3) === '.js') {
                require('../index.js').load(path.resolve(dir));
            } else {
                require('../index.js').run(dir);
            }
        }
    },
    "start": {
        help: "start program",
        "args": "[<program directory>]",
        "desc": "run the program located in the directory (or current directory, if none specified), guarded by the " +
        "service. If something bad happened, the program will be restarted. Outputs will be written to log files",
        func: commander
    },
    "stop": {
        help: "stop program",
        "args": "[<program directory> | $#Ck<--all>]",
        maxArgs: 1,
        "desc": "stop one or all programs started. All listening socket ports will be released",
        func: commander,
        completion: completeRunningJobs
    },
    "restart": {
        help: "restart program",
        "args": "[<program directory> | $#Ck<--all>]",
        maxArgs: 1,
        "desc": "restart one or all programs started. The old child process will be detached and killed soon after " +
        "several seconds, and new child will be spawned immediately. Listening socket ports will not be released",
        func: commander,
        completion: completeRunningJobs
    },
    "reload": {
        help: "reload program",
        "args": "[<program directory> | $#Ck<--all>]",
        maxArgs: 1,
        "desc": "reload one or all programs started. The old child process received a signal and will decide to exit or " +
        "do something else",
        func: commander,
        completion: completeRunningJobs
    },
    "status": {
        help: "show program status",
        maxArgs: 0,
        desc: "display the status of running programs",
        func: commander
    },
    "doc": {
        help: "generate documentation",
        args: "[<program directory>] [..options]",
        "desc": "generate documentation for all module files in <program directory>/src/module. \n\n\x1b[36mOPTIONS\x1b[0m\n\n" +
        "  \x1b[32mprogram directory\x1b[0m: root directory of a program, default to current directory. the generator will try to find module files in \x1b[32m<program directory>\x1b[0m/src/module/\n" +
        "  \x1b[32m--format <html|md>\x1b[0m: output format of generated files, defaults to md\n" +
        "  \x1b[32m--out <directory>\x1b[0m: output directory for generated files, defaults to \x1b[32m<program directory>\x1b[0m/doc/",
        func: function () {
            let target, outDir, format;
            for (let i = 0, L = arguments.length; i < L;) {
                let arg = arguments[i++];
                if (arg === '--out' || arg === '--format') {
                    if (i === L) break;
                    if (arg === '--out') {
                        if (outDir) throw 'out directory already set';
                        outDir = path.resolve(arguments[i++]);
                    } else if (arg === '--format') {
                        if (format) throw 'format already set';
                        format = arguments[i++];
                        if (format !== 'html' && format !== 'md') {
                            throw 'unsupported format'
                        }
                    }
                } else {
                    if (target) throw 'program directory already set';
                    target = path.resolve(arg);
                }
            }
            if (target) {
                process.chdir(target);
            }
            if (!outDir) {
                outDir = path.resolve('doc');
            }
            if (!format) {
                format = 'md';
            }
            let co = require('../src/co.js'),
                load = require('../index.js').load;
            co.run(function () {
                let module = co.yield(load(path.join(__dirname, '../src/module/doc.js')));
                module[Symbol.for('default')](outDir, format);
            }).done();
        },
        completion: function () {
            let lastArg = arguments[arguments.length - 1];
            if (arguments[arguments.length - 2] === '--format') {
                let buf = completion('', lastArg, 'html');
                buf = completion(buf, lastArg, 'md');
                return buf;
            }
            if (!lastArg) return;
            let buf = completion('', lastArg, '--out');
            buf = completion(buf, lastArg, '--format');
            return buf;
        }
    },
    "init": {
        help: "initialize project structure",
        desc: "Generate default project structure with a default config file, module and resource directories, and so on",
        func: function () {
            require('./init.js');
        }
    },
    "publish": {
        help: "publish a module",
        args: "<...module names>",
        desc: "modules are located in current directory as <module name>.js.\nFor example:\n\n    " + exec + " publish http file\n\n" +
        "will upload ‘http.js’ and ‘file.js’ to the server",
        func: function () {
            let args = arguments;
            let module = require('../index.js').load(path.join(__dirname, '../server/publish.js'));
            let co = require('../src/co.js');
            co.run(function () {
                co.yield(module)[Symbol.for('default')](args)
            }).done()
        },
        completion: function () {
            let added = {};
            for (let i = arguments.length - 1; i--;) added[arguments[i] + '.js'] = true;
            let last = arguments[arguments.length - 1];

            let files = fs.readdirSync('.');
            let rFile = /^\w+\.js$/;
            let output = '';
            for (let file of files) {
                if (!rFile.test(file) || file in added) continue;
                if (!last || file.substr(0, last.length) === last) output += file.substr(0, file.length - 3) + '\n';
            }
            return output;
        }
    },
    "logs": {
        help: "print program stdout/stderr log message",
        args: "<program path>",
        maxArgs: 1,
        func: function (dir) {
            if (!arguments.length) {
                return showHelp();
            }
            let file = path.join(process.env.HOME, '.agentk/programs');
            if (!fs.existsSync(file)) return;
            let arr = JSON.parse(fs.readFileSync(file, 'utf8'));
            dir = path.resolve(dir);
            if (win32) dir = dir.replace(/\\/g, '/').toLowerCase();
            let found;
            for (let program of arr) {
                if (program.dir === dir) {
                    found = program;
                    break
                }
            }
            if (!found) {
                console.error("'" + dir + "' not found in running programs");
                return
            }

            if (!found.stdout && !found.stderr) {
                console.error("'" + dir + "' stdout/stderr not redirected to file");
                return
            }

            require('../src/logs.js')(found);

        },
        completion: completeRunningJobs
    },
    "service": {
        help: "service controlling scripts",
        args: "start|stop|install|uninst",
        maxArgs: 2,
        get desc() {
            callService('description');
            return '';
        },
        func: function (arg0, arg1) {
            if (arg0 === 'install' || arg0 === 'uninst') {
                rcScript(arg0, arg1)
            } else {
                callService('service ' + arg0);
            }
        },
        completion: function (arg0, arg1) {
            if (arguments.length === 1) {
                let output = '';
                for (let arg of commands.service.args.split('|')) {
                    output = completion(output, arg0, arg);
                }
                return output;
            } else if (arg0 === 'install') { // two arguments
                let buf = '';
                for (let line of fs.readFileSync('/etc/passwd', 'binary').split('\n')) {
                    if (!line || line.substr(line.length - 8) === '/nologin' || line.substr(line.length - 6) === '/false') continue;
                    buf = completion(buf, arg1, line.substr(0, line.indexOf(':')))
                }
                return buf;
            } else if (arg0 === 'uninst') {
                let buf = '';
                let inittab = fs.readFileSync('/etc/inittab', 'binary'), r = /^k\w:2345:respawn:\/bin\/sh \S+ "([^"]+)"/gm, m;
                while (m = r.exec(inittab)) {
                    buf = completion(buf, arg1, m[1]);
                }
                return buf;
            }
        }
    },
    "completion": {
        help: "auto completion helper",
        args: ">> ~/.bashrc (or ~/.zshrc)",
        get desc() {
            return "enable bash completion. After install, please reopen your terminal to make sure it takes effects. \nOr you can just type in current shell:\n    $(" + exec + " completion)";
        },
        func: function (p, agentk, arg2) {
            if (!arguments.length) {
                if (process.stdout.isTTY) {
                    showHelp()
                } else {
                    let file = path.join(__dirname, 'completion.sh');
                    if (win32) {
                        if (process.env.MSYSTEM === 'MINGW32') {
                            file = '/' + file.replace(/[:\\]+/g, '/');
                        } else {
                            throw new Error("completion is not supported in this shell, Install MinGW32 and try again")
                        }
                    }
                    console.log('. ' + file)
                }
                return;
            } else if (p !== "--") {
                return;
            }
            let ret;
            if (arguments.length === 3) {
                ret = commands.help.completion(arg2);
            } else if (arguments.length > 3 && arg2 in commands && commands[arg2].completion) {
                let command = commands[arg2];
                if ('maxArgs' in command && arguments.length > command.maxArgs + 3) {
                    return;
                }
                ret = commands[arg2].completion.apply(null, [].slice.call(arguments, 3));
            }
            ret && ret.length && process.stdout.write(ret);
        }
    }
};


function rcScript(cmd, uname) {
    if (process.platform !== 'linux')
        return console.log(cmd + ' is only supported on linux');
    if (process.getuid()) {
        return console.log(cmd + ' must be run with root privilege')
    }
    if (!uname) {
        uname = process.env.USER;
        console.log(xtermEscape('$#ry<WARN> username not specified, using ' + uname));
    }
    let inittab = '/etc/inittab',
        script = ':2345:respawn:/bin/sh "' + __dirname + '/daemon.sh" "' + uname + '" "' + process.execPath + '"\n',
        current = fs.readFileSync(inittab, 'utf8');

    let idx = current.indexOf(script), installed = idx !== -1;

    if (cmd === 'install') {
        if (installed) {
            return console.log('service already installed')
        }
        let found_ids = current.match(/^k[0-9a-zA-Z]:/mg), next_id;
        for (let i of '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ') {
            if (!found_ids || found_ids.indexOf('k' + i + ':') === -1) {
                next_id = i;
                break
            }
        }
        if (!next_id) {
            throw new Error("no unique key available")
        }
        console.log(next_id, script);
        fs.appendFileSync(inittab, 'k' + next_id + script);
    } else if (cmd === 'uninst') {
        if (installed) {
            fs.writeFileSync(inittab, current.substr(0, idx - 2) + current.substr(idx + script.length))
        } else {
            console.log('service not installed')
        }
    }
}

function completeRunningJobs(arg) {
    // read active jobs from file
    let file = path.join(process.env.HOME, '.agentk/programs');
    if (!fs.existsSync(file)) return;
    let arr = JSON.parse(fs.readFileSync(file, 'utf8')),
        curr = win32 ? process.cwd().replace(/\\/g, '/').toLowerCase() : process.cwd(),
        output = '';


    for (let program of arr) {
        let dir = program.dir;
        if (dir === curr) {
            output = completion(output, arg, '.', dir);
        } else if (curr[curr.length - 1] !== '/' && dir.substr(0, curr.length) === curr) {
            output = completion(output, arg, dir.substr(curr.length + 1), dir);
        } else {
            output = completion(output, arg, dir);
        }
    }
    return output;
}

function completion(buf, arg0) {
    for (let i = 2, L = arguments.length; i < L; i++) {
        let str = arguments[i];
        if (!arg0 || str.substr(0, arg0.length) === arg0) {
            return buf + str + '\n'
        }
    }
    return buf
}

function showHelp() {
    process.argv[2] = 'help';
    commands.help.func(cmd);
}

if (!cmd || !(cmd in commands)) {
    cmd = "help"
}
commands[cmd].func.apply(null, process.argv.slice(3));
