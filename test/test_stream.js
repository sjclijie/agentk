import * as stream from '../src/module/stream';

const assert = require('assert'), assertEqual = assert.strictEqual;
let test = new Test("stream");


test.test('read', function () {
    assertEqual('' + stream.read(newInput(10)), '10\n9\n8\n7\n6\n5\n4\n3\n2\n1\n', 'received stream not match');
});

test.test('iterator', function () {

    let iterator = stream.iterator(newInput(10));
    let result = '';
    for (let buf of iterator) {
        result += buf;
    }
    assertEqual(result, '10\n9\n8\n7\n6\n5\n4\n3\n2\n1\n', 'received stream not match');
});


function newInput(n) {
    let input = new (require('stream').Readable);
    input._read = function () {
        input._read = Boolean;
        setTimeout(sched, 0);
        function sched() {
            input.push(new Buffer(n + '\n'));
            if (--n === 0) {
                return input.push(null);
            }
            setTimeout(sched, 10);
        }
    };
    return input;
}