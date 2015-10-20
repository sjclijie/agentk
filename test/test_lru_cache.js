import LRUCache from '../src/module/lru_cache';

const assert = require('assert'), assertEqual = assert.strictEqual;

let test = new Test('LRUCache');

test.test('base', function () {
    let cache = LRUCache();
    assertEqual(cache.get('foo'), undefined);
    cache.set('foo', 'bar');
    assertEqual(cache.get('foo'), 'bar');
    cache.set('foo', 'baz');
    assertEqual(cache.get('foo'), 'baz');
});

test.test('capacity', function () {
    let cache = LRUCache(1);
    cache.set('foo', 'bar');
    assertEqual(cache.get('foo'), 'bar');
    cache.set('foo', 'baz');
    assertEqual(cache.get('foo'), 'baz');
    cache.set('foo2', 'bar');
    assertEqual(cache.get('foo'), undefined);
    assertEqual(cache.get('foo2'), 'bar');
});

test.test('lru', function () {
    let cache = LRUCache(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4); // b,c,d
    assertEqual(cache.get('a'), undefined);
    assertEqual(cache.get('c'), 3); // b,d,c
    cache.set('e', 5); // d,c,e

    assertEqual(cache.get('b'), undefined);
    assertEqual(cache.get('c'), 3); // d,e,c
    cache.set('f', 6); // c,e,f
    assertEqual(cache.get('d'), undefined);
});