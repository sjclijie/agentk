import * as redis from '../src/module/redis';

const assert = require('assert');
let pool = redis.pool('redis://test@localhost?connections=4');

let rnd = Math.random() + '';

pool.set('a', 123);
pool.increase('a');
assert.strictEqual(pool.get('a'), '124');

pool.decrease('a');
assert.strictEqual(pool.get('a'), "123");

pool.decreaseBy('a', 3);
assert.strictEqual(pool.get('a'), "120");

pool.increaseBy('a', 5);
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

const randomRet = conn.hget('obj', 'test2');

assert.strictEqual(conn.hget('obj', 'test'), rnd);
assert.strictEqual(conn.hget('obj', 'testsdfadfadf'), null);

assert.deepEqual(conn.hkeys('obj').sort(), ['test', 'test2']);

assert.deepEqual(conn.hmget('obj', ['test', 'test2']), [rnd, randomStr]);
assert.deepEqual(pool.hmget('obj', ['test', 'test2']), [rnd, randomStr]);

assert.deepEqual(conn.hgetall('obj'), {test: rnd, test2: randomStr});

let nextID = 0;

setInterval(function () {
    let id = nextID++;
    co.run(function () {
        let conn = pool.getConnection();
        console.log(id, Date.now() + ': got new connection', conn.id, conn.socket.id, conn.socket._state);
        co.yield([
            co.run(function () {
                assert.deepEqual(conn.hmget('obj', ['test', 'test2']), [rnd, randomStr]);
            }),
            co.run(function () {
                assert.deepEqual(conn.hmget('obj', ['test', 'test2']), [rnd, randomStr]);
            }),
            co.run(function () {
                assert.deepEqual(conn.hmget('obj', ['test', 'test2']), [rnd, randomStr]);
            }),
            co.run(function () {
                assert.deepEqual(conn.hmget('obj', ['test', 'test2']), [rnd, randomStr]);
            })
        ]);

        co.sleep(50);
        conn.release();
    }).then(null, function (err) {
        console.error(id, err.stack);
    });
}, 100);