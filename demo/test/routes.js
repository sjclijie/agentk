import route from '../src/route.js';
import {read} from '../src/module/file.js';

let it = test.it('route', route);

it.test('get index');
let response = it.get('/');
it.assertEqual(response.status, 200, 'bad response status');
it.assertEqual(response.headers['Content-Type'], 'text/html', 'bad response content type');


it.test('404 catcher');
response = it.get('/i.dont.exist');
it.assertEqual(response.status, 404, 'bad response status');
it.assertEqual(response.headers['Content-Type'], 'text/html', 'bad response content type');
it.assertEqual(response.body.toString(),
    '<h1>Oops</h1><p>Something bad happened. <a href="javascript:history.back()">back</a></p>',
    'bad response content'
);

it.test('static file handler');
response = it.get('/static/index.css');
it.assertEqual(response.status, 200, 'bad response status');
it.assert(!Buffer.compare(response.body, read('static/index.css')), 'bad response content');

it.test('cookie handler');
response = it.postForm('/step3', {name: 'foobar'});
it.assertEqual(response.status, 302, 'bad response status');
it.assertEqual(response.headers.Location, '/step4', 'bad redirect location');
it.assertEqual(response.headers['Set-Cookie'], 'name=foobar; path=/; expires=Thu, 31 Dec 2099 00:00:00 GMT', 'bad cookie');

it.test('calculator');
response = it.request({
    method: 'PUT',
    url: '/step3',
    body: new Buffer('12+45')
});
it.assertEqual(response.status, 200, 'bad response status');
it.assertEqual(response.headers['Content-Type'], 'application/json', 'bad response content type');
it.assertEqual(JSON.parse(response.body).result, 57, 'bad result');