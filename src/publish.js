"use strict";

const http = require('http');
let host = process.env.MODULE_SERVER_HOST || require('../server/manifest.json').config.storage.host, port, idx = host.indexOf(':');
if(idx !== -1) {
	port = +host.substr(idx + 1);
	host = host.substr(0, idx);
} else {
	port = 80;
}

exports.download = function(name, directory) {
	let manifest = global.manifest;
	let path;
	let shortname = name.substr(0, name.length - 3);
	if(manifest && shortname in manifest.dependencies && manifest.dependencies[shortname] !== '*') {
		path = '/' + shortname + '@' + manifest.dependencies[name] + '.js';
	} else {
		path = '/' + name;
	}
	return new Promise(function(resolve, reject) {
		http.request({
			method: 'GET',
			host: host,
			port: port,
			path: path
		}, function(tres) {
			console.log(tres.statusCode);
			if(tres.statusCode !== 200) {
				reject(new Error("module not installed and not found on remote server: " + shortname));
			}
		}).on('error', reject).end();
	})
}
