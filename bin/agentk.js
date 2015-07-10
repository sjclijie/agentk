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

function callService() {
    require('../index.js').load(path.join(__dirname, '../src/service/controller.js')).then(function (module) {
        require('../src/co.js').promise(module[cmd]).then(null, function (err) {
            if (err.code === 'ECONNREFUSED' || err.code === 'ENOENT') {
                console.error('command \'' + cmd + '\' failed, maybe service not started?')
            } else {
                console.error(err.message)
            }
            process.exit(-1)
        });
    }).done()
}

function service(dir) {
    if (dir === '--all') {
        if (cmd === 'start') {
            console.error(exec + ' start --all is not supported');
            process.exit(-1);
        }
        cmd += 'All';
    } else if (dir !== undefined) {
        if (!require('fs').statSync(dir).isDirectory()) {
            console.error(exec + ' ' + cmd + ' requires directory name as parameter')
            process.exit(-1);
        }
        process.chdir(dir);
    }
    callService()
}

let commands = {
    "help": {
        help: "print this help message",
        "args": "[<command>]",
        "desc": "display usage of commands",
        func: function (subcmd) {
            let cmd = process.argv[2];
            if (cmd === 'help' && arguments.length && subcmd in commands) { // help <cmd>
                let command = commands[subcmd];
                console.log(xtermEscape("$#Gk<usage>: $#Bk<" + exec + "> " + subcmd + " " + (command.args || "") + "\n"));
                console.log(xtermEscape('desc' in command ? command.desc : command.help));
                return;
            } else if (!cmd || cmd === 'help' && !subcmd) { // agentk help?
                console.log(xtermEscape("$#Gk<usage>: $#Bk<" + exec + "> <command> [<args>]\n"));
            } else {
                if (cmd === 'help') { // agentk help xxx
                    cmd = subcmd
                }
                console.log(xtermEscape("command not found: $#Rk<" + cmd + ">\n"));
            }

            console.log(xtermEscape("possible commands are:"));
            Object.keys(commands).forEach(function (cmd) {
                console.log(xtermEscape("  $#yk<" + cmd + ">" + "           ".substr(cmd.length) + commands[cmd].help))
            });
            console.log(xtermEscape("\ntype $#Bk<" + exec + "> help <command> to get more info"));
        }, completion: function (prefix) {
            if (arguments.length > 1) return;
            let output = '';
            for (let txt of Object.keys(commands)) {
                if (!prefix || txt.substr(0, prefix.length) === prefix) output += txt + '\n'
            }
            console.log(output);
        }
    },
    "run": {
        help: "run program without crash respawn",
        "args": "[<program directory> | <main module>]",
        "desc": "run the program located in the directory (or current directory, if none specified) directly in current " +
        "terminal, outputs will be printed into stdout/stderr.\nHit Ctrl-c to terminate execution",
        func: function (dir) {
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
        func: service
    },
    "stop": {
        help: "stop program",
        "args": "[<program directory> | $#Ck<--all>]",
        "desc": "stop one or all programs started. All listening socket ports will be released",
        func: service,
        completion: completeRunningJobs
    },
    "restart": {
        help: "restart program",
        "args": "[<program directory> | $#Ck<--all>]",
        "desc": "restart one or all programs started. The old child process will be detached and killed soon after " +
        "several seconds, and new child will be spawned immediately. Listening socket ports will not be released",
        func: service,
        completion: completeRunningJobs
    },
    "reload": {
        help: "reload program",
        "args": "[<program directory> | $#Ck<--all>]",
        "desc": "reload one or all programs started. The old child process received a signal and will decide to exit or " +
        "do something else",
        func: service,
        completion: completeRunningJobs
    },
    "status": {
        help: "show program status",
        args: "",
        desc: "display the status of running programs",
        func: callService
    },
    "doc": {
        help: "generate documentation",
        args: "[<program directory>] [$#Ck<--out> <output directory>] [$#Ck<--format> <html|md>]",
        "desc": "generate documentation for all module files in program directory. User can specify output directory " +
        "(default to: <program directory>/doc) and format (html or md(markdown), default to md)",
        func: function () {

        }
    },
    "init": {
        help: "initialize project structure",
        args: "",
        desc: "Generate default project structure with a default config file, module and resource directories, and so on",
        func: function () {
            // TODO generate manifest.json
            // TODO mkdir module
            // TODO create index.js
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
            co.promise(function () {
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
            console.log(output);
        }
    },
    "logs": {
        help: "print program stdout/stderr log message",
        args: "<service path>",
        func: function (dir) {
            if (!arguments.length) {
                return showHelp();
            }
            let file = path.join(process.env.HOME, '.agentk/programs');
            if (!fs.existsSync(file)) return;
            let arr = JSON.parse(fs.readFileSync(file, 'utf8'));
            dir = path.resolve(dir);
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
    "rc-install": {
        help: "create init.rc script",
        func: function () {

        }
    },
    "rc-purge": {
        help: "remove init.rc script",
        func: function () {

        }
    },
    "completion": {
        help: "auto completion helper",
        args: ">> ~/.bashrc (or ~/.zshrc)",
        get desc() {
            return "enable bash completion. After install, please reopen your terminal to make sure it takes effects. \nOr you can just type in current shell:\n    . " + getCompletionFile();
        },
        func: function (p, agentk, arg2, arg3) {
            if (!arguments.length) {
                if (process.stdout.isTTY) {
                    showHelp()
                } else {
                    console.log('. ' + getCompletionFile())
                }
            } else if (p !== "--") {
                return;
            }
            if (arguments.length === 3) {
                commands.help.completion(arg2);
            } else if (arguments.length > 3 && arg2 in commands && commands[arg2].completion) {
                commands[arg2].completion.apply(null, [].slice.call(arguments, 3));
            }
        }
    }
};

function getCompletionFile() {
    let file = path.join(__dirname, 'completion.sh');
    if (process.platform === 'win32') {
        if (process.env.MSYSTEM === 'MINGW32') {
            file = '/' + file.replace(/[:\\]+/g, '/');
        } else {
            throw new Error("completion is not supported in this shell, Install MinGW32 and try again")
        }
    }
    return file;
}

function completeRunningJobs(arg) {
    if (arg) return;
    // read active jobs from file
    let file = path.join(process.env.HOME, '.agentk/programs');
    if (!fs.existsSync(file)) return;
    let arr = JSON.parse(fs.readFileSync(file, 'utf8')),
        curr = process.cwd(),
        output = '';
    for (let program of arr) {
        let dir = program.dir;
        if (dir === curr) {
            output += '.\n';
        } else if (dir.substr(0, curr.length) === curr) {
            output += dir.substr(curr.length + 1).replace(/\\/g, '/') + '\n';
        } else {
            output += dir.replace(/\\/g, '/') + '\n';
        }
    }
    process.stdout.write(output);
}

function showHelp() {
    process.argv[2] = 'help';
    commands.help.func(cmd);
}

if (!cmd || !(cmd in commands)) {
    cmd = "help"
}
commands[cmd].func.apply(null, process.argv.slice(3));
