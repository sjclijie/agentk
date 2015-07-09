import * as http from '../module/http.js';
import * as file from '../module/file.js';
import * as cp from '../module/child_process.js';

const path = require('path');
process.chdir(process.env.HOME);
if(!file.exists('.agentk')) {
	file.mkdir('.agentk');
}
process.chdir('.agentk');

export function start() {
	tryCallService('start', null);
	console.log('start called')
}

export function status() {
	console.log('status called')
}

function callService(name, data) {
	let resp = http.request({
		method: 'POST',
		socketPath: 'daemon.sock',
		path: '/api/'
	}, JSON.stringify(data));

	console.log(resp.statusCode);
	console.log(http.read(resp));
}

function tryCallService(name, data) {
	if(!file.exists('daemon.sock')) {
		console.error('starting service...');
		fork_service();
		co.sleep(300);
		return callService(name, data);
	}
	try {
		callService(name, data);
	} catch (e) {
		console.error('command `' + name + '\'failed, restarting service...');
		fork_service();
		co.sleep(300);
		callService(name, data); // retry
	}
}

function fork_service() {
	cp.fork(path.join(__dirname, 'daemon.js'), {
		stdout: 'out.log',
		stderr: 'err.log',
		detached: true
	}).unref()
}
