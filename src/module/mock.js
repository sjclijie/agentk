import * as http from 'http';

const testers = [];

const _fetch = http.fetch;

http.fetch = function (url, options) {
    let req = typeof url === 'object' ? url : new http.Request(url, options);

    for (let i = 0, L = testers.length; i < L; i++) {
        let pair = testers[i], ret = pair[0].apply(req, [req]);
        if (ret) {
            if (ret instanceof http.Response) return Promise.resolve(ret);
            ret = pair[1];
            if (ret) return Promise.resolve(ret);
        }
    }

    return _fetch(req, options);
};

export default function (tester, resp) {
    testers.push([tester, resp]);
}