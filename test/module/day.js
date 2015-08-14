import * as response from '../../src/module/http_response.js';

export default function () {
    return response.data('' + new Date().getDay())
}