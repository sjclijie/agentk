# AgentK: Synchronous Node.JS web service framework

## features

  - support for new ES6 style module loading
  - write async scripts synchronously
  - intergreted process monitor supporting clusters 
  - support for view engines

## Getting started

### Installation

Open a terminal and type:

    npm install kyriosli/agentk -g

If you are using linux/osx, or mingw32 on windows, you can also enable bash/zsh auto completion by typing:

    ak completion >> ~/.bashrc (or ~/.zshrc)

### Writing code

AgentK uses modern ES6 features including:

  - [modules and importing/exporting](https://github.com/lukehoban/es6features#modules)
  - [Promise](https://github.com/lukehoban/es6features#promises)

It uses [Fibers](https://github.com/laverdet/node-fibers) to get around callbacks in Node.JS development. The example
below shows a simple http server that returns static file as well as forward proxy web pages (See [test/test.js](test/test.js)):

```js
// test.js
import {listen, request, read} from '../src/module/http.js';
import * as response from '../src/module/http_response.js';
import Router from '../src/module/router.js';
import * as view from '../src/module/view.js';

const route = new Router();

route.prefix('/static', function (req) {
    console.log(req.timeStart, req.url);
    return response.file(req.url.substr(1))
        .setHeader('Content-Type', 'text/javascript')
        .enableGzip();
});

route.match(/^\/([^\/]+)(\/.*)/, function (req, host, path) {
    console.log(host, path);
    var tres = request({
        method: 'GET',
        host: host,
        path: path
    });
    return response.stream(tres)
        .setStatus(tres.statusCode)
        .setHeaders(tres.headers)
});

let server = listen(3000, route);
console.log('test listening on', server.address());
```
Type `ak run test.js` to run the program

### Running the program

Agentk can run the program directly, as well as guard its process to prevent system down, and restarts it when the server
maching is rebooted. Type `ak help` to get help message.
 
 Available commands are:
 
  - `help`        print this help message
  - `run`         run program without crash respawn
  - `start`       start program
  - `stop`        stop program
  - `restart`     restart program
  - `reload`      reload program (partial implemented)
  - `status`      show program status
  - `doc`         generate documentation (not implemented)
  - `init`        initialize project structure (not implemented)
  - `publish`     publish a module
  - `logs`        print program stdout/stderr log message
  - `svc-install` create init.rc script (not implemented)
  - `svc-purge`   remove init.rc script (not implemented)
  - `svc-start`   start service daemon
  - `svc-stop`    stop service daemon
  - `completion`  auto completion helper

When using `ak start program` to enable guarding of the process, a `manifest.json` must be created in the program directory (see [test/manifest.json](test/manifest.json)),
and the name of the program directory is supplied to the command line.

`manifest.json` contains:

  - `main` the entry module path of the program. Default to "index.js"
  - `directory` the work directory of the program. Default to the program directory
  - `workers` number of processes to be spawned to run the program, default `1`
  - `stdout` the path of the stdout log file to be appended, default to `~/.agentk/out.log`
  - `stderr` the path of the stderr log file to be appended, default to `~/.agentk/err.log`
  - `dependencies` map the depended modules of the program to is revision.

All paths are relative to the program directory.

Use `ak init` to create an empty program structure. (NOT implemented)

## Writing modules

TODO

### Module server

TODO

### Publishing modules

TODO

### Module auto loading

TODO