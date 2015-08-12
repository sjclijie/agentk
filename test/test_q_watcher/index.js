import * as q_watcher from '../../src/module/q_watcher.js';

q_watcher.prefix = 't.shaodw.test.agentk.q_watcher';

setTimeout(function func() {
    let t = Math.random() * 6000;
    q_watcher.add('t_' + (Math.random() * 5 | 0), t);
    setTimeout(func, t);
}, 1000);