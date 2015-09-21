import Router from '../src/module/router.js';

const assert = require('assert'), assertEqual = assert.strictEqual;

let test = new Test('router');

test.test('all', function () {
    let $req = {};
    let router = new Router();

    router.all(function (req) {
        assertEqual(arguments.length, 1);
        assertEqual(req, $req);
        $req.called = true;
    });

    router.apply($req, [$req]);
    assert($req.called);
});


test.test('exact', function () {
    let $req = {pathname: '/foo/bar'};
    let router = new Router();

    router.exact('/foo/bar', function (req) {
        assertEqual(arguments.length, 1);
        assertEqual(req, $req);
        $req.called = true;
    });

    router.apply($req, [$req]);
    assert($req.called);
});

test.test('prefix', function () {
    let $req = {pathname: '/foo/bar', url: '/foo/bar?a=b'};
    let router = new Router();

    router.prefix('/foo', function (req) {
        assertEqual(arguments.length, 1);
        assertEqual(req, $req);
        assertEqual(req.pathname, '/bar');
        assertEqual(req.url, '/bar?a=b');
        $req.called = true;
    });

    router.apply($req, [$req]);
    assertEqual($req.pathname, '/foo/bar');
    assertEqual($req.url, '/foo/bar?a=b');
    assert($req.called);
});


test.test('match', function () {
    let $req = {pathname: '/foo/bar'};
    let router = new Router();

    router.match(/^\/foo\/(\w+)/, function (req, m) {
        assertEqual(arguments.length, 2);
        assertEqual(m, 'bar');
        assertEqual(req, $req);
        $req.called = true;
    });

    router.apply($req, [$req]);
    assert($req.called);
});

test.test('catcher', function () {
    let $req = {pathname: '/foo/bar'};
    let router = new Router();
    let $err = {};

    router.catcher(function (req, err) {
        assertEqual(arguments.length, 2);
        assertEqual(err, $err);
        assertEqual(req, $req);
        $req.called = true;
    }).all(function () {
        throw $err;
    });

    router.apply($req, [$req]);
    assert($req.called);
});

test.test('multiple', function () {
    let $req = {pathname: '/foo/bar', url: '/foo/bar?a=b'};
    let router = new Router();

    router.prefix('/foo', function (req) {
        assertEqual(arguments.length, 1);
        assertEqual(req, $req);
        assertEqual(req.pathname, '/bar');
        assertEqual(req.url, '/bar?a=b');
        $req.called = true;
        return {};
    });

    router.prefix('/foo2', function (req) {
        assertEqual(arguments.length, 1);
        assertEqual(req, $req);
        assertEqual(req.pathname, '/baz');
        assertEqual(req.url, '/baz?a=b');
        $req.called = true;
        return {};
    });

    router.apply($req, [$req]);
    assertEqual($req.pathname, '/bar');
    assertEqual($req.url, '/bar?a=b');
    assert($req.called);

    $req = {pathname: '/foo2/baz', url: '/foo2/baz?a=b'};
    router.apply($req, [$req]);
    assertEqual($req.pathname, '/baz');
    assertEqual($req.url, '/baz?a=b');
    assert($req.called);
});


test.test('cascade', function () {
    let $req = {pathname: '/foo/bar/baz', url: '/foo/bar/baz?a=b'};
    let router = new Router();

    router.match(/^\/(\w+)/, function (req, m) {
        assertEqual(arguments.length, 2);
        assertEqual(m, 'foo');
        assertEqual(req, $req);
        assertEqual(req.pathname, '/foo/bar/baz');
        assertEqual(req.url, '/foo/bar/baz?a=b');
        $req.called = true;
    }).prefix('/foo/bar', function (req, m) {
        assertEqual(arguments.length, 2);
        assertEqual(m, 'foo');
        assertEqual(req, $req);
        assertEqual(req.pathname, '/baz');
        assertEqual(req.url, '/baz?a=b');
        $req.called2 = true;
    }).exact('/baz', function (req, m) {
        assertEqual(arguments.length, 2);
        assertEqual(m, 'foo');
        assertEqual(req, $req);
        assertEqual(req.pathname, '/baz');
        assertEqual(req.url, '/baz?a=b');
        $req.called3 = true;
    });

    router.apply($req, [$req]);
    assertEqual($req.pathname, '/foo/bar/baz');
    assertEqual($req.url, '/foo/bar/baz?a=b');
    assert($req.called);
    assert($req.called2);

});

test.test('cascade catcher', function () {
    let $req = {pathname: '/foo/bar/baz', url: '/foo/bar/baz?a=b'};
    let router = new Router();
    let $err = {};

    let catcher = new Router(function (req, err) {
        assertEqual(arguments.length, 2);
        assertEqual(err, $err);
        assertEqual(req, $req);
        $req.called = true;
    });

    router.catcher(catcher).prefix('/foo/bar', function (req) {
        assertEqual(arguments.length, 1);
        assertEqual(req, $req);
        assertEqual(req.pathname, '/baz');
        assertEqual(req.url, '/baz?a=b');
        throw $err;
    });

    router.apply($req, [$req]);
    assert($req.called);
});

test.test('completion', function () {
    let $req = {pathname: '/foo/bar'};
    let router = new Router();
    let $response = {};

    router.match(/^\/foo\/(\w+)/, function (req, m) {
        assertEqual(arguments.length, 2);
        assertEqual(m, 'bar');
        assertEqual(req, $req);
        $req.called = true;
        return $response;
    });

    router.complete(function (req, result) {
        assertEqual(arguments.length, 2);
        assertEqual(req, $req);
        assertEqual(result, $response);
        $req.called2 = true;
        return 'xxx'
    });
    router.complete(function (req, result) {
        assertEqual(arguments.length, 2);
        assertEqual(req, $req);
        assertEqual(result, 'xxx');
        $req.called3 = true;
        return 'yyy'
    });

    let result = router.apply($req, [$req]);
    assert($req.called);
    assert($req.called2);
    assert($req.called3);
    assertEqual(result, 'yyy');
});