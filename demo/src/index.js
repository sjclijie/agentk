/**
 * Entry file for AgentK demo project.
 *
 */

import {listen} from 'module/http.js';
import route from 'route.js';

let server = listen(manifest.config.port, route);

console.log('server started at', server.address());