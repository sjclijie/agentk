<!-- @rev b973488e08f83be0648d8d1479f82d79 20ae7b -->
# child_process

Wrapper for child process
 

----




## Methods

------------------------------------------------------------------------
### fork()

```js
function fork(module, options) 
```


 Creates a new Node.JS process and runs the specific node module. See: [child\_process.fork](https://nodejs.org/api/child_process.html#child_process_child_process_fork_modulepath_args_options)
 for more information about process creation.


**Params**

  - module `string`
    <br>bootstrap module path (filename or directory with a `package.json` present)
  - options(optional) `object`
    <br>optional arguments

   - options.stdout: stdout file path to be forwarded
   - options.stderr: stderr file path to be forwarded
   - options.ipc: create a ipc channel (which enables `child_process.send` and `process.send`)
   - options.detached: child process is a new process group
   - options.uid: setuid
   - options.gid: setgid
   - options.env: environment variables


**Returns**

> {node.child_process::ChildProcess}
 
