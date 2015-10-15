import * as xml from '../src/module/xml';

const assert = require('assert'), assertEqual = assert.strictEqual;
let test = new Test("gbk");

test.test('build', function () {
    assertEqual(xml.build({}),
        '<xml></xml>');

    assertEqual(xml.build({TAG: 'html'}),
        '<html></html>');

    assertEqual(xml.build({TEXT: 'foobar'}),
        '<xml>foobar</xml>');

    assertEqual(xml.build({foo: {TEXT: 'bar'}}),
        '<xml><foo>bar</foo></xml>');

    assertEqual(xml.build({foo: {TEXT: 'bar~&', CDATA: true}}),
        '<xml><foo><![CDATA[bar~&]]></foo></xml>');

    assertEqual(xml.build({foo: {TAG: 'FOO', TEXT: 'bar~&', CDATA: true}}),
        '<xml><FOO><![CDATA[bar~&]]></FOO></xml>');

    assertEqual(xml.build({foo: [{TEXT: 'bar'}, {TEXT: 'baz'}]}),
        '<xml><foo>bar</foo><foo>baz</foo></xml>');
});