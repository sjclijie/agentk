import * as http from '../src/module/http.js';
import * as response from '../src/module/http_response.js'


http.listen(3001, function (req) {
    for (let i = 0; i < 5; i++) {
        co.sleep(10);
    }
    return response.ok();
});