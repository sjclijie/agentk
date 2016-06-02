/**
 * Welcome to AgentK documentation generator! This page is automatically generated from source file.
 *
 * @title AgentK documentation generator
 */

import {mkParentDir, read, write, readdir} from "file";

const esprima = require('../javascript/esprima.js'),
    Syntax = esprima.Syntax,
    parse = esprima.parse,
    _path = require('path'),
    parseMarkup = require('../markdown.js').toHTML;

const resource_root = _path.join(__dirname, '../../doc');

const parseOption = {
    sourceType: 'module',
    range: true,
    comment: true,
    attachComment: true
};

const singleLines = {
    method: true,
    class: true,
    type: true
};

function Empty() {
}
Empty.prototype = Object.create(null);

export function doc(outDir) {
    const tpl = require('ejs').compile('' + read(resource_root + '/doc.ejs'));

    ['doc.css'].forEach(file => {
        copy(_path.join(resource_root, file), _path.join(outDir, file))
    });

    const modules = readdir('src/module').filter(filename => filename.slice(-3) === '.js').sort().map(filename => filename.slice(0, -3));
    const infos = new Empty();

    // 遍历模块列表
    for (let module of modules) {
        console.log('parsing ' + module);

        const source = '' + read('src/module/' + module + '.js');
        let ast;
        try {
            ast = parse(source, parseOption);
        } catch (e) {
            console.error('failed parsing src/module/' + module + '.js: ' + e.message);
            continue;
        }


        const decls = new Empty(), exports = new Empty();
        const info = {
            name: module,
            title: 'Module ' + module,
            infos,
            modules,
            decls,
            exports,
            description: '',
            examples: null,
            constants: [],
            variables: [],
            functions: [],
            classes: []
        };


        const stmts = ast.body;
        // assert(stmts.length);
        // handle first comment
        const first_stmt = stmts[0],
            first_comment = first_stmt.leadingComments && first_stmt.leadingComments[0];
        if (first_comment && first_comment.type === 'Block') {
            const parsed = parseComment(first_comment.value);
            info.comment = parsed;
            checkComment(info);
            if (parsed.title || !is_decl(first_stmt)) {
                first_stmt.leadingComments.shift();
                // has a title stmt
                if (parsed.title) info.title = parsed.title[0];
            }
        }

        // 遍历声明语句
        for (let stmt of  stmts) {
            if (!is_decl(stmt)) continue;
            const comment = stmt.leadingComments && stmt.leadingComments[stmt.leadingComments.length - 1];
            const parsed_comment = comment && comment.type === 'Block' && parseComment(comment.value);

            switch (stmt.type) {
                case Syntax.ExportNamedDeclaration:
                    if (stmt.declaration) { // export var ...
                        findDecls(stmt.declaration, function (id, info) {
                            info.comment = parsed_comment;
                            decls[id.name] = info;
                            exports[id.name] = id.name;
                        });
                    } else { // export {...}
                        for (let spec of stmt.specifiers) {
                            exports[spec.exported.name] = spec.local.name;
                        }
                        // console.log(stmt)
                    }
                    break;
                case Syntax.ExportDefaultDeclaration:
                {
                    const decl = stmt.declaration;
                    if ((decl.type === Syntax.ClassDeclaration || decl.type === Syntax.FunctionDeclaration) && !decl.id) {
                        decl.id = {type: Syntax.Identifier, name: 'anonymous'};
                    }
                    decl.comment = parsed_comment;
                    switch (decl.type) {
                        case Syntax.ClassDeclaration:
                            onClass(decl);
                        case Syntax.FunctionDeclaration:
                            decls[decl.id.name] = decl;
                            exports[decl.id.name] = exports[moduleDefault] = decl.id.name;
                            break;
                        default:
                            exports[moduleDefault] = decl;
                            break;
                    }
                }
                    break;
                default:
                    findDecls(stmt, function (id, info) {
                        info.comment = parsed_comment;
                        decls[id.name] = info;
                    });
                    if (stmt.type === Syntax.ClassDeclaration && parsed_comment && parsed_comment.export) {
                        exports[parsed_comment.export[0].trim() || stmt.id.name] = stmt.id.name;
                    }
                    break;
            }
        }

        // 遍历exports
        if (exports[moduleDefault]) {
            const val = exports[moduleDefault];
            info.default = typeof val === 'string' ? decls[val] : val;
        }
        for (let key of Object.keys(exports).sort()) {
            const local = decls[exports[key]], comment = local.comment || {};
            checkComment(local);
            local.exported = key;
            switch (local.type) {
                case Syntax.FunctionDeclaration:
                    info.functions.push(key);
                    local.proto = source.slice(local.range[0], local.body.range[0] - 1).trimRight();
                    break;
                case Syntax.ClassDeclaration:
                    info.classes.push(key);
                    if (local.superClass) {
                        local.superClass = source.slice(local.superClass.range[0], local.superClass.range[1])
                    }
                    if (local.body.body.length) {
                        local.methods = local.body.body;
                        local.methods.forEach(checkComment);
                    }
                    break;
                case Syntax.VariableDeclarator:
                {
                    let type;
                    if (comment.type) {
                        type = comment.type;
                    } else if (local.init) {
                        switch (local.init.type) {
                            case 'Literal':
                                type = typeof local.init.value;
                                break;
                            case 'ObjectExpression':
                                type = 'object';
                                break;
                        }
                    } else {
                        type = 'unknown';
                    }
                    local.type = type;

                    if (comment.method) {
                        info.functions.push(key);
                        local.proto = 'function ' + key + '()'
                    } else {
                        (local.kind === 'const' ? info.constants : info.variables).push(local);
                    }
                    break;
                }
                default:
                    throw new Error('unknown export ' + local.type);
            }
        }

        infos[module] = info;
    }
    for (let module of modules) {
        write(outDir + '/' + module + '.html', tpl(infos[module]));
    }

}

const parseCode = function () {
    const classes = {
        '\'': 'string',
        '"': 'string',
        '/': 'comment',
        '.': 'number',
        '0': 'number',
        '1': 'number',
        '2': 'number',
        '3': 'number',
        '4': 'number',
        '5': 'number',
        '6': 'number',
        '7': 'number',
        '8': 'number',
        '9': 'number'
    };

    const globals = {console: true, co: true, process: true, require: true, module: true};

    const rMatch = /<|>|'(?:[^'\\]|\\[xrnt'"])+'|"(?:[^"\\]|\\[xrnt'"])*"|\/\/.*|\/\*[\s\S]*?\*\/|\b(?:\d+(?:\.\d+)?|\.\d+|var|if|let|for|in|of|typeof|class|while|do|switch|case|default|try|new|function|import|export|as|from|return|console|co|require|module|process)\b/g;

    function repl(m) {
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        const className = classes[m[0]] || (m in globals ? 'global' : 'kw');
        if (className === 'string') {
            m = m.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
        return `<span class="${className}">${m}</span>`
    }

    return function (str) {
        str = str.trim().replace(rMatch, repl);
        const m = str.match(/\n\s*/g);
        if (!m) return str;
        const minLen = m.reduce(function (minLen, m) {
            return m.length < minLen ? m.length : minLen
        }, Infinity);
        if (minLen === 1) return str;
        return str.replace(/\n\s*/g, s => s.slice(0, s.length - minLen + 1))
    }
}();

function checkComment(obj) {
    const comment = obj.comment;
    if (!comment) return;
    if (comment.description) {
        obj.description = parseMarkup(comment.description.join('\n'))
    }
    if (comment.example) {
        obj.examples = comment.example.map(parseCode)
    }

}

function copy(source, target) {
    if (source === target) {
        return console.error('copy: omitting file ' + source);
    }
    mkParentDir(target);
    write(target, read(source));
}

const typeReg = /\w+(\.\w+)*|[<>]/g;


const parseType = function () {
    const knownTypes = {
        '<': '&lt;',
        '>': '&gt;',
        Buffer: '<a href="https://nodejs.org/api/buffer.html#buffer_class_buffer">Buffer</a>'
    };

    function typeRepl(m) {
        if (m in knownTypes) return knownTypes[m];
        if (/^([nN]umber|[sS]tring|[bB]oolean|[oO]bject|[fF]unction|[aA]rray|null|undefined|ArrayBuffer|Promise|Iterator|Iterable)$/.test(m))
            return `<span class="primitive">${m}</span>`;

        if (m.slice(0, 5) === 'node.') {
            const names = m.split('.');
            return `<a href="https://nodejs.org/api/${names[1]}.html#${names[1]}_class_${names.slice(2).join('_').toLowerCase()}">${names[1]}::${names[names.length - 1]}</a>`
        } else if (m.indexOf('.') > -1) {
            const names = m.split('.');
            return `<a href="${names[0] + '.html#class-' + names[1]}">${names[0]}::${names[1]}</a>`
        } else {
            return `<a href="${'#class-' + m}">${m}</a>`
        }
    }

    return function (str) {
        if (!str) return str;
        str = str.trim();
        if (str[0] === '{' && str[str.length - 1] === '}')
            str = str.slice(1, -1);
        return str.replace(typeReg, typeRepl)
    }

}();

function parseParam(param) {
    const m = /^(?:\{(.+?)\}\s+)?(?:(\[)(\w+)\]|(\w+))?(?:\s+([\s\S]*))?$/.exec(param);
    if (!m)
        return;
    return {
        type: parseType(m[1]),
        optional: !!m[2],
        name: m[m[2] ? 3 : 4],
        description: parseMarkup(m[5] || '')
    }
}

function findDecls(stmt, onDecl) {
    switch (stmt.type) {
        case Syntax.ClassDeclaration:
            onClass(stmt);
        case Syntax.FunctionDeclaration:
            onDecl(stmt.id, stmt);
            break;
        case Syntax.VariableDeclaration:
            for (let decl of stmt.declarations) {
                decl.kind = stmt.kind;
                onDecl(decl.id, decl)
            }
            break;
        default:
            return false;
    }
}

function onClass(decl) {
    for (let method of decl.body.body) {
        if (method.leadingComments) {
            let comment = method.leadingComments[method.leadingComments.length - 1];
            if (comment.type === 'Block') {
                method.comment = parseComment(comment.value);
            }
        }
    }
}

function is_decl(stmt) {
    switch (stmt.type) {
        case Syntax.VariableDeclaration:
        case Syntax.FunctionDeclaration:
        case Syntax.ClassDeclaration:
        case Syntax.ExportNamedDeclaration:
        case Syntax.ExportDefaultDeclaration:
            return true;
        default:
            return false;
    }
}

function parseComment(comment) {
    if (comment[comment.length - 1] === '\n') comment = comment.slice(0, comment[comment.length - 2] === '\r' ? -2 : -1);
    // comment = comment.trimRight().replace(/^\*\r?\n[ \t]*\*\s*/, '').replace(/\r?\n[ \t]*\*\r?\n/g, '\n\n');

    const ret = new Empty();
    let current = 'description';
    ret.description = [''];

    for (let line  of comment.split('\n')) {
        line = line.trim().replace(/^\s*\*\s?/, '');
        const m = /^@(\w+)(?:\s|$)/.exec(line);
        if (m) {
            current = m[1];
            const arr = ret[current] || (ret[current] = []);
            arr.push(line.substr(m[0].length));
            if (current in singleLines) {
                current = 'description';
            }
        } else {
            const arr = ret[current];
            arr[arr.length - 1] += '\n' + line;
        }
    }

    ret.description[0] = ret.description[0].substr(1);
    if (ret.param) ret.param = ret.param.map(parseParam).filter(Boolean);
    if (ret.type) {
        ret.type = parseType(ret.type[0]);
    }
    if (ret.returns) {
        ret.returns = parseParam(ret.returns[0]);
    }
    return ret;
}