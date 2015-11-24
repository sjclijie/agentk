/**
 * Fast handlebars helper that generates faster precompiled method, which outputs a `Buffer`
 * rather than a string
 *
 * @title Fast Handlebars Helper
 */

const hb = require('handlebars');
export default hb;

hb.fast_compile = function (string, options = {}) {
    let program = hb.parse(string, options);
    walk(program);
    const fn = hb.compile(program, options);
    return function (data) {
        return new Buffer(fn(data), 'binary')
    }
};

hb.registerHelper('$buffer', function (ctx, options) {
    return new Buffer(options.fn(ctx), 'binary')
});

hb.registerHelper('$encode', function (ctx, options) {
    return encode(options.fn(ctx))
});

function walk(program) {
    program.body.forEach(onStmt);
}

const rEscaped = /[^\x00-\x7f]/;
function onStmt(stmt, i, arr) {
    switch (stmt.type) {
        case 'ContentStatement':
            stmt.value = encode(stmt.value);
            break;
        case 'BlockStatement':
            walk(stmt.program);
            stmt.inverse && walk(stmt.inverse);
            break;
        case 'MustacheStatement':
            arr[i] = {
                type: 'BlockStatement',
                path: {
                    type: 'PathExpression',
                    data: false,
                    depth: 0,
                    parts: ['$encode'],
                    original: '$encode'
                }, params: [{
                    type: 'PathExpression',
                    data: false,
                    depth: 0,
                    parts: [],
                    original: '.'
                }], program: {
                    type: 'Program',
                    body: [stmt],
                    strip: {}
                }
            }
    }
}

const SlowBuffer = require('buffer').SlowBuffer;
let bufLen = 4096, buf = new SlowBuffer(bufLen);
export function encode(value) {
    if (typeof value === 'string' && rEscaped.test(value)) {
        let expectedLen = value.length * 3;
        if (bufLen < expectedLen) {
            do {
                bufLen <<= 1
            } while (bufLen < expectedLen);
            buf = new SlowBuffer(bufLen);
        }
        return buf.toString('binary', 0, buf.write(value));
    }
    return value;
}