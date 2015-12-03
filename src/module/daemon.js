const win32 = process.platform === 'win32';

export function jobs() {
    return exec('status');
}

export function status(job) {
    return exec('status', [win32 ? job.replace(/\\/g, '/').toLowerCase() : job])[0]
}

export function start(job) {
    return trigger('start', job);
}

export function stop(job) {
    return trigger('stop', job);
}

export function restart(job) {
    return trigger('restart', job);
}

export function trigger(action, job) {
    return exec(action, win32 ? job.replace(/\\/g, '/').toLowerCase() : job)
}

export function exec(cmd, data) {
    return process.sendAndWait({action: 'daemon', cmd, data})
}