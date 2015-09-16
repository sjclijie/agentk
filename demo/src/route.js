/**
 * This is the route rules config file for
 */

import Router from 'module/router.js';
import * as view from 'module/view.js';
import {Response} from 'module/http.js';

view.view_engine = manifest.config.view_engine;
view.path = manifest.config.views;

const route = new Router();

route.exact('/', function (req) {
    return view.render("index", {
        title: 'Demo project for AgentK',
        message: 'It works!'
    });
});

// TODO: add more url rules

route.all(function () {
    return new Response('<h1>Oops</h1><p>Something bad happened. <a href="javascript:history.back()">back</a></p>', {
        status: 404,
        headers: {
            'content-type': 'text/html'
        }
    })
});

export default route;