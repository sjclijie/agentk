import route from '../src/route.js';

let it = test.it('route', route);

it.test('get index');
let response = it.get('/');
it.assertEqual(response.status, 200, 'bad response state');
it.assertEqual(response.headers['Content-Type'], 'text/html', 'bad response content type');


it.test('404 catcher');
response = it.get('/i.dont.exist');
it.assertEqual(response.status, 404, 'bad response state');
it.assertEqual(it.read(response).toString(),
    '<h1>Oops</h1><p>Something bad happened. <a href="javascript:history.back()">back</a></p>',
    'bad response content'
);
it.assertEqual(response.headers['Content-Type'], 'text/html', 'bad response content type');
it.assertEqual(response.headers['Content-Length'], '88', 'bad response content length');
