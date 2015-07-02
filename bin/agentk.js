#!/bin/sh
":" // ; exec /usr/bin/env node --harmony "$0" "$@"
"use strict";

let min_version = 'v0.12.2';

if (process.version < min_version) {
    throw new Error("agentk runs on Node.js " + min_version + " or higher, please upgrade your installation and try again.");
}

let cp = require('child_process');

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

function xtermEscape(str) {
    return str.replace(/\$#[rgbcmykw]{2}<(.+?)>/gi, function (m, text) {
        return '\x1b[3' + colors[m[2]] + ';4' + colors[m[3]] + 'm' + text + '\x1b[0m';
    });
}

let commands = {
    "help": {
        help: "print this help message",
        "args": "[<command>]",
        "desc": "display help message.",
        func: function (subcmd) {
            let cmd = process.argv[2];
            if (cmd === 'help' && arguments.length && subcmd in commands) { // agentk help <cmd>
                let command = commands[subcmd];
                console.log(xtermEscape("$#Gk<usage>: $#Bk<agentk> " + subcmd + " " + (command.args || "") + "\n"));
                console.log(xtermEscape(command.desc));
                return;
            } else if (!cmd || cmd === 'help' && !subcmd) { // agentk help?
                console.log(xtermEscape("$#Gk<usage>: $#Bk<agentk> <command> [<args>]\n"));
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
            console.log(xtermEscape("\ntype $#Bk<agentk> help <command> to get more info"));
        }
    },
    "run": {
        help: "run program without crash respawn",
        "args": "[<program directory>]",
        "desc": "run the program located in the directory (or current directory, if none specified) directly in current " +
        "terminal, outputs will be printed into stdout/stderr.\nHit Ctrl-c to terminate execution",
        func: function (dir) {
            if (arguments.length !== 0) {
                process.chdir(dir);
            }
            require('../index.js').runMain();
        }
    },
    "start": {
        help: "start program",
        "args": "[<program directory>]",
        "desc": "run the program located in the directory (or current directory, if none specified), guarded by the " +
        "service. If something bad happened, the program will be restarted. Outputs will be written to log files",
        func: function () {

        }
    },
    "stop": {
        help: "stop program",
        "args": "[<program directory> | $#Ck<all>]",
        "desc": "stop one or all programs started. All listening socket ports will be released",
        func: function () {

        }
    },
    "restart": {
        help: "restart program",
        "args": "[<program directory> | $#Ck<all>]",
        "desc": "restart one or all programs started. The old child process will be detached and killed soon after " +
        "several seconds, and new child will be spawned immediately. Listening socket ports will not be released",
        func: function () {

        }
    },
    "reload": {
        help: "reload program",
        "args": "[<program directory> | $#Ck<all>]",
        "desc": "reload one or all programs started. The old child process received a signal and will decide to exit or " +
        "do something else",
        func: function () {

        }
    },
    "status": {
        help: "show program status",
        args: "",
        func: function () {

        }
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
        desc: "modules are located in current directory as <module name>.js.\nFor example:\n\n    agentk publish http file\n\n" +
        "will upload ‘http.js’ and ‘file.js’ to the server",
        func: function () {
            require('../server/publish.js')(arguments);
        }
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
    }
};

let cmd = process.argv[2];

if (!cmd || !(cmd in commands)) {
    cmd = "help"
}
commands[cmd].func.apply(null, process.argv.slice(3));