"use strict";


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

    }

    static bar() {
        console.log('bar called with', this);
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

new MyTest('abc').foobar();

Test.bar();