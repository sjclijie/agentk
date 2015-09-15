import * as http from '../src/module/http.js';


const assert = require('assert'), assertEqual = assert.strictEqual;
let test_headers = new Test("Headers");

test_headers.test('constructor', function() {
	let headers = new http.Headers(), entries = headers[Object.getOwnPropertySymbols(headers)[0]];
	assertEqual(entries.length, 0);

	assert_entries(null, 0);
	assert_entries(true, 0);
	assert_entries({}, 0);
	assert_entries({a: 0}, 1);
	assert_entries({a: 0, A: 0}, 2);

	function assert_entries(param, count) {
		let headers = new http.Headers(param), entries = headers[Object.getOwnPropertySymbols(headers)[0]];
		assertEqual(entries.length, count);
	}
});

test_headers.test('entries', function() {
	let headers = new http.Headers({
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
			value: ['b', '1']
		});
		assert.deepEqual(iterator.next(), {
			done: false,
			value: ['a', '2']
		});
		assert.deepEqual(iterator.next(), {
			done: true,
			value: undefined
		});	
		assertEqual(iterator[Symbol.iterator](), iterator);
	}
});

test_headers.test('keys', function() {
	let headers = new http.Headers({
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
		value: 'b'
	});
	assert.deepEqual(iterator.next(), {
		done: false,
		value: 'a'
	});
	assert.deepEqual(iterator.next(), {
		done: true,
		value: undefined
	});	
	assertEqual(iterator[Symbol.iterator](), iterator);
});

test_headers.test('values', function() {
	let headers = new http.Headers({
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
		value: '1'
	});
	assert.deepEqual(iterator.next(), {
		done: false,
		value: '2'
	});
	assert.deepEqual(iterator.next(), {
		done: true,
		value: undefined
	});	
	assertEqual(iterator[Symbol.iterator](), iterator);
});

test_headers.test('forEach', function() {
	let headers = new http.Headers({
		a: 0,
		b: 1,
		A: 2
	});

	let expected = [
		['a', '0'],
		['b', '1'],
		['a', '2']
	];

	headers.forEach(function(val, name, target) {
		let part = expected.shift();
		assertEqual(arguments.length, 3);
		assertEqual(val, part[1]);
		assertEqual(name, part[0]);
		assertEqual(target, headers);
	});
	assertEqual(expected.length, 0)
});

test_headers.test('append', function() {
	let headers = new http.Headers({
		a: 0,
		b: 1,
		A: 2
	});

	let entries = [];

	headers.forEach(push);
	assert.deepEqual(entries, ['a: 0', 'b: 1', 'a: 2']);

	entries.length = 0;
	headers.append('c', '3');
	headers.forEach(push);
	assert.deepEqual(entries, ['a: 0', 'b: 1', 'a: 2', 'c: 3']);

	entries.length = 0;
	headers.append('a', '4');
	headers.forEach(push);
	assert.deepEqual(entries, ['a: 0', 'b: 1', 'a: 2', 'c: 3', 'a: 4']);

	function push(val, name) {
		entries.push(name + ': ' + val);
	}
});

test_headers.test('delete', function() {
	let headers = new http.Headers({
		a: 0,
		b: 1,
		A: 2
	});

	let entries = [];

	headers.forEach(push);
	assert.deepEqual(entries, ['a: 0', 'b: 1', 'a: 2']);

	entries.length = 0;
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

test_headers.test('set', function() {
	let headers = new http.Headers({
		a: 0,
		b: 1,
		A: 2
	});

	let entries = [];

	headers.forEach(push);
	assert.deepEqual(entries, ['a: 0', 'b: 1', 'a: 2']);

	entries.length = 0;
	headers.set('c', '3');
	headers.forEach(push);
	assert.deepEqual(entries, ['a: 0', 'b: 1', 'a: 2', 'c: 3']);

	entries.length = 0;
	headers.set('a', '4');
	headers.forEach(push);
	assert.deepEqual(entries, ['b: 1', 'c: 3', 'a: 4']);

	function push(val, name) {
		entries.push(name + ': ' + val);
	}
});

test_headers.test('get', function() {
	let headers = new http.Headers({
		a: 0,
		b: 1,
		A: 2
	});

	assertEqual(headers.get('a'), '0');
	assertEqual(headers.get('B'), '1');
	assertEqual(headers.get('c'), null);
});

test_headers.test('getAll', function() {
	let headers = new http.Headers({
		a: 0,
		b: 1,
		A: 2
	});

	assert.deepEqual(headers.getAll('a'), ['0', '2']);
	assert.deepEqual(headers.getAll('B'), ['1']);
	assert.deepEqual(headers.getAll('c'), []);
});

test_headers.test('has', function() {
	let headers = new http.Headers({
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
	ret._read = function() {
		ret._read = function(){};

		setTimeout(sched, 0);

		function sched() {
			if(bufs.length) {
				ret.push(bufs.shift());
				setTimeout(sched, 10);
			} else {
				ret.push(null)
			}
		}
	};
	return ret;
}

test_body.test("constructor", function() {
	assertEqual(co.yield(new http.Body('foobar').text()), 'foobar');
	assertEqual(co.yield(new http.Body(new Buffer('foobar')).text()), 'foobar');
	assertEqual(co.yield(new http.Body(new Uint8Array(new Buffer('foobar')).buffer).text()), 'foobar');
	assertEqual(co.yield(new http.Body(mkReadable([new Buffer('foobar')])).text()), 'foobar');

	let hasCaught = false;
	try {
		new http.Body({});
	} catch(e) {
		assert(/^body accepts only/.test(e.message));
		hasCaught = true;
	}
	assert(hasCaught);
});

