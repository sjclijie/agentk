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
assert.deepEqual(((a, b, ...c) => c)(1, 2, 3), [3]);

//// Testing classes
export class Test {
    constructor() {
        super();
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
assert.strictEqual(a.xxx, 123);

Test.bar();
assert.strictEqual(Test.baz(), "baz");

