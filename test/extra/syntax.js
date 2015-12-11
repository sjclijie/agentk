var assert = require('assert');

//// arrow functions
assert.deepEqual([1, 2, 3, 4].map(x => x * x), [1, 4, 9, 16]);

//// object properties
let obj = {
    assert, test() {
        return 1234
    }
};

assert.strictEqual(obj.assert, assert);
assert.strictEqual(obj.test(), 1234);

//// Rest arguments
function test(a, b, ...c) {
    return c
}

assert.deepEqual(test(), []);
assert.deepEqual(test(1, 2, 3), [3]);
assert.deepEqual(function (a, b, ...c) {
    return c
}(1, 2, 3), [3]);

//// Testing classes
export class Test {
    constructor() {
        //super();
        this.name = void 0;
    }

    test() {
        this.hello('test')
    }

    hello(src) {
        console.log('hello, %s %s', this.name, src);
    }

    get foo() {
        console.log('getting foo');
        return this.name;
    }

    set ["foo"](x) {
        console.log('setting foo', x);
    }

    static bar() {
        console.log('bar called with', this);
    }

    static ["baz"]() {
        return "baz"
    }


    [Symbol.iterator]() {

    }
}


export default class MyTest extends Test {
    static beforeCons() {
        return 'haha';
    }

    constructor(a) {
        super(a);
        this.name = a
    }

    foobar() {
        super.test();
        super.hello('foobar');
    }

    get xxx() {
        return super.XXX
    }
}

let a = new MyTest('abc');
a.foobar();
void a.foo;
a.foo = 0;

Test.prototype.XXX = 123;
assert.strictEqual(MyTest.beforeCons(), 'haha');
assert.strictEqual(a.xxx, 123);

Test.bar();
assert.strictEqual(Test.baz(), "baz");

var assert = require('assert');
var slice = [].slice;

function withDefault(a, b = 1, d = a + b, ...c) {
    return {a, b, c, d}
}
asserts(withDefault);
asserts(function (a, b = 1, d = a + b, ...c) {
    return {a, b, c, d}
});

withDefault = (a, b = 1, d = a + b, ...c) => {
    return {a, b, c, d}
};
asserts(withDefault);
asserts((a, b = 1, d = a + b, ...c) => {
    return {a, b, c, d}
});

function withoutDefault(a, b = 1, d = a + b) {
    return {a, b, d}
}
asserts2(withoutDefault);
asserts2(function (a, b = 1, d = a + b) {
    return {a, b, d}
});

withoutDefault = (a, b = 1, d = a + b) => {
    return {a, b, d}
};
asserts2(withoutDefault);
asserts2((a, b = 1, d = a + b) => {
    return {a, b, d}
});

let nonBlock = (a, b = 1, d = a + b, ...c)=> ({a, b, c, d});
asserts(nonBlock);
asserts((a, b = 1, d = a + b, ...c)=> ({a, b, c, d}));

let simpleNonBlock = (a, b = 1, d = a + b, ...c) => a + b + d + (c[0] || 4);

assert.strictEqual(simpleNonBlock(1), 8);
assert.strictEqual(simpleNonBlock(1, 2), 10);

// test rest
function rest(a, b, d, ...c) {
    if (b === undefined)b = 1;
    if (d === undefined)d = a + b;
    return {a, b, c, d}
}
asserts(rest);

rest = (a, b, d, ...c) => {
    if (b === undefined)b = 1;
    if (d === undefined)d = a + b;
    return {a, b, c, d}
};
asserts(rest);

var restNonBlock = (a, b, d, ...c) => ({
    a,
    b: b === undefined ? 1 : b,
    d: d === undefined ? b === undefined ? a + 1 : a + b : d,
    c
});

asserts(restNonBlock);

function restOneParam(...c) {
    return {a: c[0], b: c[1] || 1, d: c[2] || (c[1] || 1) + c[0], c: c.slice(3)}
}

asserts(restOneParam);

restOneParam = (...c) => {
    return {a: c[0], b: c[1] || 1, d: c[2] || (c[1] || 1) + c[0], c: c.slice(3)}
};

asserts(restOneParam);

var restOneParamNonBlock = (...c) => ({a: c[0], b: c[1] || 1, d: c[2] || (c[1] || 1) + c[0], c: c.slice(3)});

asserts(restOneParamNonBlock);

var restOneParamSimpleNonBlock = (...c) => c[0];

assert.strictEqual(restOneParamSimpleNonBlock(12), 12);

function asserts(method) {
    assert.deepEqual(method(2), {a: 2, b: 1, c: [], d: 3});
    assert.deepEqual(method(2, void 0), {a: 2, b: 1, c: [], d: 3});
    assert.deepEqual(method(2, 4), {a: 2, b: 4, c: [], d: 6});
    assert.deepEqual(method(2, 4, 5), {a: 2, b: 4, c: [], d: 5});
    assert.deepEqual(method(2, 4, 5, 3, 8), {a: 2, b: 4, c: [3, 8], d: 5});
}
function asserts2(method) {
    assert.deepEqual(method(2), {a: 2, b: 1, d: 3});
    assert.deepEqual(method(2, void 0), {a: 2, b: 1, d: 3});
    assert.deepEqual(method(2, 4), {a: 2, b: 4, d: 6});
    assert.deepEqual(method(2, 4, 5), {a: 2, b: 4, d: 5});
    assert.deepEqual(method(2, 4, 5, 3, 8), {a: 2, b: 4, d: 5});
}

function firstIsDefault(option = {foo: 'bar'}) {
    return option.foo
}

assert.strictEqual(firstIsDefault(), 'bar');

firstIsDefault = (option = {foo: 'bar'}, foo = option.foo) => {
    return foo
};
assert.strictEqual(firstIsDefault(), 'bar');
var firstIsDefaultNonBlock = (option = {foo: 'bar'}, foo = option.foo) => foo;
assert.strictEqual(firstIsDefaultNonBlock(), 'bar');

function firstIsDefaultWithRest(option = {foo: 'bar'}, ...extra) {
    return extra[0] + option.foo
}
assert.strictEqual(firstIsDefaultWithRest(), 'undefinedbar');
assert.strictEqual(firstIsDefaultWithRest(undefined, 'foo'), 'foobar');