import * as q_watcher from '../../src/module/q_watcher.js';

q_watcher.prefix = 't.agentk.q_watcher';

q_watcher.setupPeers(['l-qzz1.fe.dev.cn6', 'l-qzz2.fe.dev.cn6'], require('os').hostname(), 8012);

setTimeout(function func() {
    let t = Math.random() * 6000;
    q_watcher.add('t_' + (Math.random() * 5 | 0), t);
    setTimeout(func, t);
}, 1000);