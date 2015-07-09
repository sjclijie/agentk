#!/bin/sh
":" // ; exec /usr/bin/env node --harmony "$0" "$@"
"use strict";

let exec = 'ak';

let min_version = 'v0.12.2';

if (process.version < min_version) {
    throw new Error(exec + " runs on Node.js " + min_version + " or higher, please upgrade your installation and try again.");
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

let cmd = process.argv[2];


function xtermEscape(str) {
    return str.replace(/\$#[rgbcmykw]{2}<(.+?)>/gi, function (m, text) {
        return '\x1b[3' + colors[m[2]] + ';4' + colors[m[3]] + 'm' + text + '\x1b[0m';
    });
}

function callService() {
    require('../index.js').load(require('path').join(__dirname, '../src/service/controller.js')).then(function(module) {
		require('../src/co.js').promise(module[cmd]);
    }).done()
}

function service(dir) {
    if(dir === '--all') {
        if(cmd === 'start') {
            return console.error(exec + ' start --all is not supported');
        }
        cmd += 'All';
    } else if(dir!== undefined) {
        process.chdir(dir);
    }
    callService()
}

let commands = {
    "help": {
        help: "print this help message",
        "args": "[<command>]",
        "desc": "display help message.",
        func: function (subcmd) {
            let cmd = process.argv[2];
            if (cmd === 'help' && arguments.length && subcmd in commands) { // help <cmd>
                let command = commands[subcmd];
                console.log(xtermEscape("$#Gk<usage>: $#Bk<" + exec + "> " + subcmd + " " + (command.args || "") + "\n"));
                console.log(xtermEscape(command.desc));
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
        }, completion: function(prefix) {
			if(arguments.length > 1) return;
			let output = '';
			for (let txt of Object.keys(commands)) {
				if(!prefix || txt.substr(0, prefix.length) === prefix) output += txt + '\n'
			}
			console.log(output);
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
            require('../index.js').run();
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
        func: service
    },
    "restart": {
        help: "restart program",
        "args": "[<program directory> | $#Ck<--all>]",
        "desc": "restart one or all programs started. The old child process will be detached and killed soon after " +
        "several seconds, and new child will be spawned immediately. Listening socket ports will not be released",
        func: service
    },
    "reload": {
        help: "reload program",
        "args": "[<program directory> | $#Ck<--all>]",
        "desc": "reload one or all programs started. The old child process received a signal and will decide to exit or " +
        "do something else",
        func: service
    },
    "status": {
        help: "show program status",
        args: "",
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
            require('../server/publish.js')(arguments);
        },
		completion: function() {
			let added = {};
			for(let i = arguments.length - 1; i--; ) added[arguments[i] + '.js'] = true;
			let last = arguments[arguments.length - 1];
			
			let files = require('fs').readdirSync('.');
			let rFile = /^\w+\.js$/;
			let output = '';
			for(let file of files) {
				if(!rFile.test(file) || file in added) continue;
				if(!last || file.substr(0, last.length) === last) output += file.substr(0, file.length - 3) + '\n';
			}
			console.log(output);
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
    },
	"completion": {
		help: "auto completion helper",
		args: ">> ~/.bashrc (or ~/.zshrc)",
		desc: "enable bash completion. After install, please reopen your terminal to make sure it takes effects. \nOr you can just type in current shell:\n    . " + require('path').join(__dirname, 'completion.sh'),
		func: function(p, agentk, arg2, arg3) {
			if(!arguments.length) {
				if(process.stdout.isTTY) {
					process.argv[2] = cmd = 'help';
					commands.help.func('completion');
				} else {
					console.log('. ' + require('path').join(__dirname, 'completion.sh'))
				}
			} else if(p !== "--") {
				return;
			}
			if(arguments.length === 3) {
				commands.help.completion(arg2);
			} else if(arguments.length > 3 && arg2 in commands && commands[arg2].completion) {
				commands[arg2].completion.apply(null, [].slice.call(arguments, 3));
			}
		}
	}
};


if (!cmd || !(cmd in commands)) {
    cmd = "help"
}
commands[cmd].func.apply(null, process.argv.slice(3));
