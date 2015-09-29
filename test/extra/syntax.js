//// arrow functions
console.log([1, 2, 3, 4].map(x => x * x));

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
}

let a = new MyTest('abc');
a.foobar();
void a.foo;
a.foo = 0;


Test.bar();