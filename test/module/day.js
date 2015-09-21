import {Response} from '../../src/module/http.js';

export default function () {
    return new Response('' + new Date().getDay())
}