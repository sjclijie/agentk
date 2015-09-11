import * as gbk from '../src/module/gbk.js';

const assert = require('assert'), assertEqual = assert.strictEqual;
let test = new Test("gbk");

test.test("encode", function () {
    assert(!Buffer.compare(gbk.encode('趣'), new Buffer([0xC8, 0xA4])), 'chinese');
    assert(!Buffer.compare(gbk.encode('ASDF'), new Buffer('ASDF')), 'ascii');
    assert(!Buffer.compare(gbk.encode('ABCD 趣'), new Buffer([0x41, 0x42, 0x43, 0x44, 0x20, 0xC8, 0xA4])), 'mixed');

    let _err;
    try {
        gbk.encode('\uffff');
    } catch (e) {
        _err = e;
    }
    assert(_err);
});

test.test("decode", function () {
    assertEqual(gbk.decode(new Buffer([0xC8, 0xA4])), '趣', 'chinese');
    assertEqual(gbk.decode(new Buffer([0x41, 0x42, 0x43, 0x44, 0x20, 0xC8, 0xA4])), 'ABCD 趣', 'mixed');
    assertEqual(gbk.decode(new Buffer([0x41, 0x20, 0xff, 0xff])), 'A \ufffd\ufffd', 'replacement character');
});