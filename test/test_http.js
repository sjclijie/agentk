import {Headers, Body} from '../src/module/http.js';


const assert = require('assert'), assertEqual = assert.strictEqual;
let test_headers = new Test("Headers");

test_headers.test('constructor', function () {
    let headers = new Headers(), entries = headers[Object.getOwnPropertySymbols(headers)[0]];
    assert.deepEqual(entries, {});

    assert_entries(null, {});
    assert_entries(true, {});
    assert_entries({}, {});
    assert_entries({a: 0}, {a: ['a', '0']});
    assert_entries({A: 1}, {a: ['A', '1']});
    assert_entries({a: 0, A: 1}, {a: ['a', '0', '1']});

    function assert_entries(param, val) {
        let headers = new Headers(param), entries = headers[Object.getOwnPropertySymbols(headers)[0]];
        assert.deepEqual(entries, val);
    }
});

test_headers.test('entries', function () {
    let headers = new Headers({
        a: 0,
        b: 1,
        A: 2
    }), iterator = headers.entries();

    check(headers.entries());
    check(headers[Symbol.iterator]());

    function check(iterator) {
        assert.deepEqual(iterator.next(), {
            done: false,
            value: ['a', '0']
        });
        assert.deepEqual(iterator.next(), {
            done: false,
            value: ['a', '2']
        });
        assert.deepEqual(iterator.next(), {
            done: false,
            value: ['b', '1']
        });
        assert.deepEqual(iterator.next(), {
            done: true,
            value: undefined
        });
        assertEqual(iterator[Symbol.iterator](), iterator);
    }
});

test_headers.test('keys', function () {
    let headers = new Headers({
        a: 0,
        b: 1,
        A: 2
    }), iterator = headers.keys();

    assert.deepEqual(iterator.next(), {
        done: false,
        value: 'a'
    });
    assert.deepEqual(iterator.next(), {
        done: false,
        value: 'a'
    });
    assert.deepEqual(iterator.next(), {
        done: false,
        value: 'b'
    });
    assert.deepEqual(iterator.next(), {
        done: true,
        value: undefined
    });
    assertEqual(iterator[Symbol.iterator](), iterator);
});

test_headers.test('values', function () {
    let headers = new Headers({
        a: 0,
        b: 1,
        A: 2
    }), iterator = headers.values();

    assert.deepEqual(iterator.next(), {
        done: false,
        value: '0'
    });
    assert.deepEqual(iterator.next(), {
        done: false,
        value: '2'
    });
    assert.deepEqual(iterator.next(), {
        done: false,
        value: '1'
    });
    assert.deepEqual(iterator.next(), {
        done: true,
        value: undefined
    });
    assertEqual(iterator[Symbol.iterator](), iterator);
});

test_headers.test('forEach', function () {
    let headers = new Headers({
        a: 0,
        b: 1,
        A: 2
    });

    let expected = [
        ['a', '0'],
        ['a', '2'],
        ['b', '1']
    ];

    headers.forEach(function (val, name, target) {
        let part = expected.shift();
        assertEqual(arguments.length, 3);
        assertEqual(val, part[1]);
        assertEqual(name, part[0]);
        assertEqual(target, headers);
    });
    assertEqual(expected.length, 0)
});

test_headers.test('append', function () {
    let headers = new Headers({
        a: 0,
        b: 1,
        A: 2
    });

    let entries = [];

    headers.forEach(push);
    assert.deepEqual(entries, ['a: 0', 'a: 2', 'b: 1']);

    entries.length = 0;
    headers.append('c', '3');
    headers.forEach(push);
    assert.deepEqual(entries, ['a: 0', 'a: 2', 'b: 1', 'c: 3']);

    entries.length = 0;
    headers.append('a', '4');
    headers.forEach(push);
    assert.deepEqual(entries, ['a: 0', 'a: 2', 'a: 4', 'b: 1', 'c: 3']);

    function push(val, name) {
        entries.push(name + ': ' + val);
    }
});

test_headers.test('delete', function () {
    let headers = new Headers({
        a: 0,
        b: 1,
        A: 2
    });

    let entries = [];

    //headers.forEach(push);
    //assert.deepEqual(entries, ['a: 0', 'a: 2', 'b: 1']);
    //
    //entries.length = 0;
    headers.delete('b');
    headers.forEach(push);
    assert.deepEqual(entries, ['a: 0', 'a: 2']);

    entries.length = 0;
    headers.append('c', '3');
    headers.delete('a');
    headers.forEach(push);
    assert.deepEqual(entries, ['c: 3']);

    function push(val, name) {
        entries.push(name + ': ' + val);
    }
});

test_headers.test('set', function () {
    let headers = new Headers({
        a: 0,
        b: 1,
        A: 2
    });

    let entries = [];

    headers.forEach(push);
    assert.deepEqual(entries, ['a: 0', 'a: 2', 'b: 1']);

    entries.length = 0;
    headers.set('c', '3');
    headers.forEach(push);
    assert.deepEqual(entries, ['a: 0', 'a: 2', 'b: 1', 'c: 3']);

    entries.length = 0;
    headers.set('a', '4');
    headers.forEach(push);
    assert.deepEqual(entries, ['a: 4', 'b: 1', 'c: 3']);

    function push(val, name) {
        entries.push(name + ': ' + val);
    }
});

test_headers.test('get', function () {
    let headers = new Headers({
        a: 0,
        b: 1,
        A: 2
    });

    assertEqual(headers.get('a'), '0');
    assertEqual(headers.get('B'), '1');
    assertEqual(headers.get('c'), null);
});

test_headers.test('getAll', function () {
    let headers = new Headers({
        a: 0,
        b: 1,
        A: 2
    });

    assert.deepEqual(headers.getAll('a'), ['0', '2']);
    assert.deepEqual(headers.getAll('B'), ['1']);
    assert.deepEqual(headers.getAll('c'), []);
});

test_headers.test('has', function () {
    let headers = new Headers({
        a: 0,
        b: 1,
        A: 2
    });

    assertEqual(headers.has('a'), true);
    assertEqual(headers.has('B'), true);
    assertEqual(headers.has('c'), false);
});

// ====================== END TEST HEADERS =======================

let test_body = new Test("Body");
const Readable = require('stream').Readable;

function mkReadable(bufs) {
    let ret = new Readable();
    ret._read = function () {
        ret._read = function () {
        };

        setTimeout(sched, 0);

        function sched() {
            if (bufs.length) {
                ret.push(bufs.shift());
                setTimeout(sched, 10);
            } else {
                ret.push(null)
            }
        }
    };
    return ret;
}

test_body.test("constructor", function () {
    assertEqual(co.yield(new Body('foobar').text()), 'foobar');
    assertEqual(co.yield(new Body(new Buffer('foobar')).text()), 'foobar');
    assertEqual(co.yield(new Body(new Uint8Array(new Buffer('foobar')).buffer).text()), 'foobar');
    assertEqual(co.yield(new Body(mkReadable([new Buffer('foobar')])).text()), 'foobar');

    let hasCaught = false;
    try {
        new Body({});
    } catch (e) {
        assert(/^body accepts only/.test(e.message));
        hasCaught = true;
    }
    assert(hasCaught);
});

test_body.test("buffer", function () {
    assert(!Buffer.compare(co.yield(new Body('foo bar').buffer()),
        new Buffer('foo bar')));
});

test_body.test("arraybuffer", function () {
    assert.deepEqual(Array.prototype.slice.call(new Uint8Array(co.yield(new Body('foobar').arrayBuffer()))),
        Array.prototype.slice.call(new Buffer('foobar')));
});

test_body.test("json", function () {
    let data = {"foo": "bar", "baz": [1, 2, true]};
    assert.deepEqual(co.yield(new Body(JSON.stringify(data)).json()), data);

    let hasCaught = false;
    try {
        co.yield(new Body('{bad json}').json());
    } catch (e) {
        assert(/Unexpected token/.test(e.message));
        hasCaught = true;
    }
    assert(hasCaught);
});

function stream_read(incoming) {
    return co.promise(function (resolve, reject) {
        let bufs = [];
        incoming.on('data', function (data) {
            bufs.push(data);
        }).on('end', function () {
            resolve(Buffer.concat(bufs));
        })
    })
}

test_body.test("streaming", function () {
    let stream = mkReadable([new Buffer('foo'), new Buffer('bar')]);
    let body = new Body(stream);
    assertEqual(body.stream, stream);

    assertEqual(stream_read(body.stream).toString(), 'foobar');
    assertEqual(stream_read(body.stream).toString(), 'foobar');
    body = new Body('foobar');
    assertEqual(stream_read(body.stream).toString(), 'foobar');
});

// =================== END TEST BODY ================
