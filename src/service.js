import * as http from 'module/http.js';
import * as file from 'module/file.js';

const cp = require('child_process');

const listen_path = require('path').join(process.env.HOME, '.agentk/service.sock')

export function start() {
	callService('start', null, true);
	console.log('start called')
}

export function status() {
	console.log('status called')
}

function callService(name, data, respawn) {
	try {
		let resp = http.request({
			method: 'POST',
			socketPath: listen_path,
			path: '/api/'
		}, JSON.stringify(data));

		console.log(resp.statusCode);
		console.log(http.read(resp));
	} catch (e) {
		if(respawn) {
			fork_service()
			callService(name, data, false); // retry
		} else {
			console.error()
		}
	}
	
}

function fork_service() {
	console.error('starting service...');
	if(file.exists(listen_path)) {
		file.rm(listen_path);
	} else {
		file.mkParentDir(listen_path);
	}
	http.listen(listen_path, function(req, res) {
		console.log(req.method, req.url);
		console.log(http.read(req).toString());
	});
}