const assert = require('assert'), assertEqual = assert.equal;

// ������������ȼ�
assertEqual((1 + 2) * 3, 9);
assertEqual(1 + (2 * 3), 7);
assertEqual(2 + 3 << 4, 80);
assertEqual(2 + (3 << 4), 50);

// ���Ժ���������
(function (s) {
    assertEqual(s, 1234);
    return;
    throw new Error('should not be here')
})(1234);

void function (t) {
    assertEqual(t, 2345)
}(2345);

// ����return
assertEqual(function () {
    return 512 + 105 << 1
}(), 1234);

// �����﷨�ṹ
(function () {
    function* test(x) {
        yield x * x;
        yield x, x + 1;
        yield (x, x + 1);
        yield x = 14;
        yield* [x];
    }

    const obj = test(12);
    assertEqual(obj.next().value, 144);
    assertEqual(obj.next().value, 12);
    assertEqual(obj.next().value, 13);
    assertEqual(obj.next().value, 14);
    assertEqual(obj.next().value, 14);

    // ����if
    if (true) {
        assert.ok(true);
    } else {
        throw new Error('should not be here')
    }
    if (false) {
        throw new Error('should not be here')
    } else if (true) {
        assert.ok(true)
    } else {
        throw new Error('should not be here')
    }
    let i = 3, arr = [];
    while (i--) {
        arr.push(i);
    }
    for (i = 8; i > 5; i--) arr.push(i);
    assert.deepEqual(arr, [2, 1, 0, 8, 7, 6]);
    arr.length = 0;
    for (let j = 4; j--;) {
        arr.push(j * j);
    }
    assert.deepEqual(arr, [9, 4, 1, 0]);
    for (i of arr.splice(0, 4)) arr.push(i + 1);
    assert.deepEqual(arr, [10, 5, 2, 1]);

    i = 0;
    test: for (let j of arr) {
        i += j;
        continue test;
    }
    assertEqual(i, 18);

    do {
        i--;
    } while (i > 12);
    assertEqual(i, 12);

    switch (i) {
        case 12:
            break;
        default:
            throw new Error('should not be here')
    }

    for (let key in {foo: 0}) {
        assert.strictEqual(key, 'foo');
        return;
    }
    throw new Error('should not be here')
})();

// ����var
~function () {
    var x, y, z = 3, w = 4, u = z + w;
    assertEqual(u, 7);
    if (!x) {
        ~function () {
            const z = 4, w = 6, u = z * w;
            assertEqual(u, 24);
        }();
    } else {
        throw new Error('should not be here')
    }
}();

// ����new
new function test() {
    assert.ok(this instanceof test);
};
assertEqual(new (function () {
    return function (xxx) {
        this.xxx = xxx;
    }
}())(123)['xxx'], 123);

// �����ַ���ģ��
assertEqual(
    `a${1 + 2} ${`` + 4}`,
    'a3 4'
);

// ����class
class Test {
    base_foo(a) {
        return a + '; Test::base_foo@' + this.id
    }
}

class MyTest extends Test {
    constructor(id) {
        super(5678);
        this.id = id;
        this.X = 1234;
    }

    foo() {
        return this.constructor.className + '::' + super.base_foo('foo');
    }

    get abc() {
        return this.id << 1;
    }

    set abc(abc) {
        this.id = abc >> 1;
    }

    get [0]() {
        return (this.id + '')[0]
    }

    static get className() {
        return 'MyTest'
    }

    static getParentClass() {
        return this.prototype.__proto__.constructor;
    }
}

const test = new MyTest(1234);

assertEqual(test.foo(), 'MyTest::foo; Test::base_foo@1234');
assertEqual(test.abc, 2468);
test.abc = 48;
assertEqual(test[0], '2');
assertEqual(MyTest.getParentClass(), Test);

const Test2 = class extends Test {
    constructor(id) {
        super();
        this.id = id;
    }

    foo() {
        return 'anonymous::' + super.base_foo('foo');
    }
};

assertEqual(new Test2(33).foo(), 'anonymous::foo; Test::base_foo@33');

// ����shorthand
assertEqual({test}.test.id, 24);
assertEqual({
    test(){
        return 1234
    }
}.test(), 1234);

// ����������
//noinspection BadExpressionStatementJS
(function () {
    //noinspection BadExpressionStatementJS
    ({test})
});

// ����rest
function withRest(a, b, ...c) {
    return c
}
assert.deepEqual(withRest(), []);
assert.deepEqual(withRest(1, 2, 3), [3]);
class WithRest {
    static a(...c) {
        return c[0] + c[1]
    }
}
assert.deepEqual(WithRest.a(1, 2), 3);

// ����default
function withDefault(a, b = 1234, c = a + b) {
    return a * b + c;
}
assertEqual(withDefault(2), 3704);
assertEqual(withDefault(2, 3), 11);

function withRestAndDefault(a, b = 1234, ...c) {
    return a * b + c.length
}
assertEqual(withRestAndDefault(2), 2468);
assertEqual(withRestAndDefault(2, 3), 6);
assertEqual(withRestAndDefault(2, 3, 4), 7);

function restOneParam(...c) {
    return c
}
assertEqual(restOneParam(1234, 5678).join(), '1234,5678');


// ����ģ��export
export {test,WithRest, withDefault as _withDefault}
export let y = 0, z = 1, w = 2;
export default function () {

}

// ����ģ��import
import 'syntax.js';
import X, * as m1 from 'syntax.js';
import X, {test as _test, y as _y} from 'syntax.js';

setTimeout(function () {
    assertEqual(X, module[moduleDefault]);
    assertEqual(test.X, 1234);
    assertEqual(m1.z, z);
    m1.y = 4567;
    assertEqual(y, 4567);
    _y = 5678;
    assertEqual(m1.y, 5678);

    assertEqual(_test, test);

    // �⹹��ֵ�޸��������
    ({abc: _y} = _test);

});

// ���Ա��ʽ����
w = (1 + 2, 3 + 4);
assertEqual(w, 7);

// ���Խ⹹��ֵ
let abc;
({abc} = test);
assertEqual(abc, 48);
assert.deepEqual([abc] = ['abc'], ['abc']);
assertEqual(abc, 'abc');
({0: abc} = 'abc');
assertEqual(abc, 'a');
[{length:abc}] = 'def';
assertEqual(abc, 1);
[w, , abc] = 'def';
assertEqual(abc, 'f');

(function () {
    let {0: d, 1: e, 2: f, length} = 'DEF', g = 'G';
    assert.deepEqual({d, e, f, g, length}, {d: 'D', e: 'E', f: 'F', g: 'G', length: 3});
    return d + e + f;
})();

function defaultAndDestruct({0: a, 1: b}, [c, d] = 'cd') {
    return {a, b, c, d}
}
assert.deepEqual(defaultAndDestruct('ab'), {a: 'a', b: 'b', c: 'c', d: 'd'});
assert.deepEqual(defaultAndDestruct('ab', 'CDEF'), {a: 'a', b: 'b', c: 'C', d: 'D'});

// ���Լ�ͷ����
const arrow = x => {
    return x + 1
};
assertEqual(arrow(12), 13);
assertEqual((() => {
    return 13
})(), 13);
assertEqual(((a, b, c) => {
}).length, 3);
assertEqual((x => x + 1)(13), 14);
assertEqual(((x = 14) => x + 1)(), 15);
assertEqual(((a, b = 2, c = a + b) => a * b - c)(3), 1);
assertEqual((({x}) => x + 1)({x: 15}), 16);
assertEqual((({x} = {x: 16}) => x + 1)(), 17);

(function () {
    let {a, b, c:{d}, e:[f, {g}]} = {
        a: 1, b: 2, c: {d: 3}, e: [4, {g: 5}]
    };

    let [h,{i,j:k}] = [6, {i: 7, j: 8}];
    assert.deepEqual([a, b, d, f, g, h, i, k], [1, 2, 3, 4, 5, 6, 7, 8]);
    a = {};
    [a.b,,b] = 'foo bar baz'.split(' ');

    assert.deepEqual({a, b}, {a: {b: 'foo'}, b: 'baz'});
    let [l,,m] = [3, 4, 5];
    assert.deepEqual([l, m], [3, 5]);
})();