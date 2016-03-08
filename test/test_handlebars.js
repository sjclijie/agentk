import * as view from '../src/module/view';

import Handlebars from '../src/module/handlebars';
const assert = require('assert');

let h = view.engine(Handlebars.fast_compile);

let test = new Test('handlebars');

test.test('fast_compile', function () {
    assert.strictEqual(h('test/extra/test.handlebars', [{name: 'John'}]) + '', 'hello, 嘿嘿: John ');
    assert.strictEqual(h('test/extra/test.handlebars', [{name: 'Jack. 李'}]) + '', 'hello, 嘿嘿: Jack. 李 ');
});
