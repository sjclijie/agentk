import * as http from "../module/http.js";
import * as file from '../module/file.js';

const listen_path = 'daemon.sock';

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
