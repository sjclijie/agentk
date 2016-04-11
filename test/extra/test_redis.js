import * as redis from '../../src/module/redis';

const assert = require('assert');
let pool = redis.pool('redis://test@localhost?connections=4');

let rnd = Math.random() + '';

pool.set('a', 123);
assert.strictEqual(pool.increase('a'), 124);
assert.strictEqual(pool.get('a'), '124');

assert.strictEqual(pool.decrease('a'), 123);
assert.strictEqual(pool.get('a'), "123");

assert.strictEqual(pool.decreaseBy('a', 3), 120);
assert.strictEqual(pool.get('a'), "120");

assert.strictEqual(pool.increaseBy('a', 5), 125);
assert.strictEqual(pool.get('a'), '125');

let conn = pool.getConnection();


conn.set('foo', rnd);

assert.strictEqual(conn.get('foo'), rnd);

conn.release();

conn = pool.getConnection();

assert.strictEqual(conn.get('foo'), rnd);

assert.strictEqual(conn.get('i.dont.exist'), null);

conn.hset('obj', 'test', rnd);

const randomBuf = new Buffer(Math.sqrt(Math.random()) * 4096);
for (let i = 0; i < randomBuf.length; i++) {
    randomBuf[i] = Math.random() * 256;
}
const randomStr = new Buffer(randomBuf.toString('utf16le')).toString();

conn.hset('obj', 'test2', randomStr);

assert.strictEqual(conn.hget('obj', 'test2'), randomStr);

assert.strictEqual(conn.hget('obj', 'test'), rnd);
assert.strictEqual(conn.hget('obj', 'testsdfadfadf'), null);

assert.deepEqual(conn.hkeys('obj').sort(), ['test', 'test2']);

assert.deepEqual(conn.hmget('obj', ['test', 'test2']), [rnd, randomStr]);
assert.deepEqual(pool.hmget('obj', ['test', 'test2']), [rnd, randomStr]);

assert.deepEqual(conn.hgetAll('obj'), {test: rnd, test2: randomStr});

let nextID = 0;

for (let i = 0; i < 4; i++) {
    co.run(function (n) {
        for (; ;) {
            let id = nextID++;
            let conn = pool.getConnection();
            console.log(n, id, Date.now() + ': got new connection');
            assert.deepEqual(conn.hmget('obj', ['test', 'test2']), [rnd, randomStr]);
            conn.release();
            co.sleep(3);
        }
    }, i).done()
}
