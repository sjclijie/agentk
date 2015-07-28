import * as q_watcher from '../src/module/q_watcher.js';

q_watcher.listen(8080);

let os = require('os');


for (; ;) {
    q_watcher.recordSize('heap used', process.memoryUsage().heapUsed / 1024);
    let interval = Math.random() * 1000 | 0;
    q_watcher.recordOne('loops', interval);
    co.sleep(interval);
}