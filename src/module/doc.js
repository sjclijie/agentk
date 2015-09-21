/**
 * Welcome to AgentK documentation generator! This page is automatically generated from source file.
 *
 * @title AgentK documentation generator
 */

import * as file from 'file.js';
import {md5} from 'crypto.js';

const esprima = require('../esprima.js'),
    Syntax = esprima.Syntax,
    path = require('path');

const parseOption = {
    sourceType: 'module',
    range: true,
    comment: true,
    loc: true
};


const presetTypes = {
    Buffer: 'https://nodejs.org/api/buffer.html#buffer_class_buffer'
};
const primitiveTypes = /^([bB]oolean|[sS]tring|[nN]umber|[uU]ndefined|[nN]ull|[oO]bject|[fF]unction|[aA]rray|RegExp|Date|Error|Promise|ArrayBuffer)$/;
const rNamespace = /^(?:([\w\.]+)::)?([\w\.]+)/;

function parseTypename(name) {

    let parts = name.replace(/^\s*\{|\}\s*$/g, '').split('|');
    for (var i = 0, L = parts.length; i < L; i++) {
        var part = parts[i];
        if (part in presetTypes) {
            parts[i] = `<a href="${presetTypes[part]}">${part}</a>`
        } else if (!primitiveTypes.test(part)) {
            var m = rNamespace.exec(part);
            if (m) {
                if (m[1] && m[1].substr(0, 5) === 'node.') {
                    let module = m[1].substr(5);
                    parts[i] = `<a href="https://nodejs.org/api/${module}.html#${module}_class_${m[2].toLowerCase().replace(/\./g, '_')}">${m[2]}</a>`
                } else {
                    parts[i] = `<a href="${m[1] ? m[1] + '.html' : ''}#class-${m[2]}">${m[0]}</a>`
                }
            }
        }
    }
    return parts.join('|');
}

export default function (outDir, format) {
    process.chdir('src/module');
    //console.log(outDir, format);

    let cssFile = path.join(outDir, 'doc.css');
    const tpl_content = file.read(path.join(__dirname, '../../doc/doc_template.' + (format === 'html' ? 'ejs' : format))),
        tpl_checksum = md5(tpl_content, 'hex').substr(0, 6),
        template = require('ejs').compile(tpl_content.toString('utf8'));
    file.mkParentDir(cssFile);


    let parseMarkup;

    let after_module, after_scan;
    if (format === 'html') {
        const modules = [];
        after_module = function (module) {
            module.modules = modules;
            module.parseTypename = parseTypename;
            module.parseMarkup = parseMarkup;
            modules.push(module);
        };
        let cssInput = path.join(__dirname, '../../doc/doc.css'),
            cssContent = file.read(cssInput);
        if (!file.exists(cssFile) || Buffer.compare(cssContent, file.read(cssFile))) {
            file.write(cssFile, cssContent);
        }
        parseMarkup = require('../markdown.js').toHTML;
        after_scan = function () {
            for (let module of modules) {
                let output = path.join(outDir, module.namespace + '.' + format);
                file.write(output, template(module));
            }
        }
    } else {
        after_module = function (module) {
            let output = path.join(outDir, module.namespace + '.' + format);
            file.write(output, template(module));
        };
        after_scan = Boolean;
    }

    onDir('.');
    after_scan();

    function onDir(dir) {
        for (let name of file.readdir(dir)) {
            name = path.join(dir, name);
            if (file.isDirectory(name)) {
                onDir(name);
            } else if (name.substr(name.length - 3) === '.js') {
                let namespace = name.substr(0, name.length - 3).replace(/[\/\\]/g, '_');
                let fileContent = file.read(name),
                    checksum = md5(fileContent, 'hex');

                let module = onFile(fileContent, name);
                if (!module) return;
                module.namespace = namespace;
                module.checksum = checksum;
                module.tpl_checksum = tpl_checksum;
                after_module(module);
            }
        }
    }

    function onFile(fileContent, name) {
        let requires = [], consts = [], variables = [], methods = [];
        let specs = [], decls = {}, hasDefault;
        let module = {
            meta: null,
            requires: requires,
            consts: consts,
            variables: variables,
            methods: methods,
            _default: null
        };
        let script = fileContent.toString('utf8'), ast;
        try {
            ast = esprima.parse(script, parseOption);
        } catch (e) {
            console.warn(`\x1b[33mWARN\x1b[0m ${name}: cannot parse file: ${e.message}`);
            return null;
        }


        let stmts = ast.body,
            comments = ast.comments;

        function findComments(stmts, lastStmtEnd) {
            for (let nextStmt = 0, nextComment = 0, lastComment = comments.length;
                 nextStmt < stmts.length && nextComment < comments.length;
                 nextStmt++
            ) {
                let nextStmtRange = stmts[nextStmt].range,
                    nextStmtStart = nextStmtRange[0];
                for (; nextComment < lastComment;) {
                    let cmt = comments[nextComment],
                        cmt_range = comments[nextComment].range;
                    if (cmt.type !== 'Block' || cmt_range[0] < lastStmtEnd) {
                        //console.log(name, 'dropped comment', cmt.value);
                        nextComment++;
                        continue;
                    }
                    if (cmt_range[1] > nextStmtStart) {
                        break;
                    }
                    stmts.splice(nextStmt, 0, cmt);
                    nextStmt++;
                    //console.log(name, 'insert comment ', cmt_range, 'between', lastStmtEnd, 'and', nextStmtStart);
                    nextComment++
                }
                lastStmtEnd = nextStmtRange[1];
            }
        }

        findComments(stmts, 0);

        if (!stmts.length) return module;


        // handle first comment
        let firstStmt = stmts[0];
        if (firstStmt.type === Syntax.ExpressionStatement && firstStmt.expression.type === Syntax.Literal && firstStmt.expression.value === 'use strict') {
            //console.log(name, 'first line is use strict');
            stmts.shift();
            if (!stmts.length) return;
            firstStmt = stmts[0];
        }
        if (firstStmt.type === 'Block') {
            let nextStmt = stmts[1];
            if (/\n \* @(?:title|author)/m.test(firstStmt.value) || !nextStmt || [
                    Syntax.ExportNamedDeclaration,
                    Syntax.ExportAllDeclaration,
                    Syntax.ExportDefaultDeclaration,
                    Syntax.FunctionDeclaration,
                    Syntax.VariableDeclaration
                ].indexOf(nextStmt.type) === -1) {
                //console.log(name, 'first stmt is module description', firstStmt);
                module.meta = splitComment(firstStmt.value)
                stmts.shift();
            }
        }

        for (let i = 0, L = stmts.length; i < L; i++) {
            let stmt = stmts[i];
            if (stmt.type === Syntax.ExportNamedDeclaration) {
                let comment = previousComment(i);
                let decl = stmt.declaration;
                if (decl) { // export var | export function | export class
                    if (decl.type == Syntax.FunctionDeclaration) {
                        decls[decl.id.name] = decl;
                        decl.comment = comment;
                        onExportFunctionDecl(decl, decl.id.name);
                    } else if (decl.type === Syntax.VariableDeclaration) {
                        decl.declarations[0].comment = comment;
                        for (let vardecl of decl.declarations) {
                            vardecl.kind = decl.kind;
                            decls[vardecl.id.name] = vardecl;
                            onExportVariableDecl(vardecl, vardecl.id.name);
                        }
                    } else if (decl.type === Syntax.ClassDeclaration) {
                        decls[decl.id.name] = decl;
                        onExportClassDecl(decl, decl.id.name);
                    }
                } else { // export {xxx}
                    specs = specs.concat(stmt.specifiers);
                }
            } else if (stmt.type === Syntax.ExportDefaultDeclaration) {
                if (hasDefault) {
                    let loc = stmt.loc.start;
                    throw new Error(`${name}:${loc.line}:${loc.column}: module default has already been exported`);
                }
                let decl = hasDefault = stmt.declaration;
                if (decl.type === Syntax.FunctionDeclaration) {
                    decl.comment = previousComment(i);
                    if (decl.id) {
                        decls[decl.id.name] = decl;
                    }
                } else if (decl.type === Syntax.ClassDeclaration) {
                    if (decl.id) {
                        decls[decl.id.name] = decl;
                    }
                }
            } else if (stmt.type === Syntax.FunctionDeclaration) {
                decls[stmt.id.name] = stmt;
                stmt.comment = previousComment(i);
            } else if (stmt.type === Syntax.VariableDeclaration) {
                for (let vardecl of stmt.declarations) {
                    vardecl.kind = stmt.kind;
                    decls[vardecl.id.name] = vardecl;
                }
            } else if (stmt.type === Syntax.ClassDeclaration) {
                decls[stmt.id.name] = stmt;
            }
        }

        for (let spec of specs) {
            let decl = decls[spec.local.name];
            if (!decl) {
                let loc = spec.loc.start;
                console.warn(`\x1b[33mWARN\x1b[0m ${name}:${loc.line}:${loc.column}: local declaration not found: \x1b[31m${spec.local.name}\x1b[0m`);
                continue;
            }
            //console.log(decl);
            if (decl.type === Syntax.FunctionDeclaration) {
                onExportFunctionDecl(decl, spec.exported.name)
            } else if (decl.type === Syntax.ClassDeclaration) {
                onExportClassDecl(decl, spec.exported.name);
            } else if (decl.type === Syntax.VariableDeclarator) {
                onExportVariableDecl(decl, spec.exported.name)
            }
        }

        //console.log(name, module);

        if (hasDefault && hasDefault.type === Syntax.Identifier) {
            hasDefault = decls[hasDefault.name];
        }
        if (hasDefault) {
            if (hasDefault.type === Syntax.FunctionDeclaration) {
                if (!hasDefault.id) { // TODO: no id

                } else {
                    if (!hasDefault.exported) {
                        onExportFunctionDecl(hasDefault, hasDefault.id.name, true);
                    }
                    module._default = {
                        type: 'function',
                        title: 'fun-' + hasDefault.id.name,
                        name: hasDefault.id.name
                    };
                }
            } else if (hasDefault.type === Syntax.ClassDeclaration) {
                if (!hasDefault.id) { // TODO: no id

                } else {
                    if (!hasDefault.exported) {
                        onExportClassDecl(hasDefault, hasDefault.id.name, true);
                    }
                    module._default = {
                        type: 'class',
                        title: 'class-' + hasDefault.id.name,
                        name: hasDefault.id.name
                    };
                }
            } else if (hasDefault.type === Syntax.VariableDeclarator) {
                module._default = {
                    type: 'variable',
                    title: hasDefault.id.name,
                    name:  hasDefault.id.name
                }
            } else if (hasDefault.type === Syntax.Literal) { // expression
                //console.log(name, 'has default', hasDefault);
                module._default = {
                    type: 'literal',
                    title: '#',
                    name: hasDefault.raw
                }
            }
        }

        return module;

        function previousComment(i) {
            let ret;
            if (i && (ret = stmts[i - 1]).type === 'Block') {
                return splitComment(ret.value);
            }
            return null;
        }

        //console.log(name, exports, 'default', hasDefault);


        // console.log(name, requires, exports);
        function onExportFunctionDecl(decl, name, isDefault) {
            decl.exported = true;
            methods.push({
                title: 'fun-' + name,
                name: name,
                prototype: script.substring(decl.range[0], decl.body.range[0]),
                comment: decl.comment || {},
                _default: isDefault
            })
        }

        function onExportClassDecl(decl, name, isDefault) {
            decl.exported = true;
            let body = decl.body.body;
            findComments(body, decl.range[0]);
            //console.log(require('util').inspect(decl, {depth: 10}));
            let methodsFound = 0;
            for (let i = 0, L = body.length; i < L; i++) {
                let stmt = body[i];
                if (stmt.type === Syntax.MethodDefinition) {
                    let cmt = body[i - 1];
                    if (cmt && cmt.type === 'Block') cmt = splitComment(cmt.value);
                    else cmt = {};

                    if (stmt.kind === 'constructor') {
                        cmt.constructor = true;
                        let obj = {
                            title: 'class-' + name,
                            name: name,
                            prototype: 'function ' + name + script.substring(stmt.value.range[0], stmt.value.body.range[0]),
                            comment: cmt,
                            _default: isDefault
                        };
                        methods.splice(methods.length - methodsFound, 0, obj)
                    } else if (stmt.kind === 'method') {
                        let methodname = stmt.key.type === Syntax.Identifier ? stmt.key.name : '[' + script.substring(stmt.key.range[0], stmt.key.range[1]) + ']';
                        methods.push({
                            title: `fun-${name}-${methodname}`,
                            name: methodname,
                            prototype: `function ${name}${stmt.static ? '.' : '::'}${methodname}${script.substring(stmt.value.range[0], stmt.value.body.range[0])}`,
                            "static": stmt.static,
                            comment: cmt
                        });
                        methodsFound++;
                    } else { // getter | setter
                        cmt[stmt.kind + 'ter'] = true;
                        methods.push({
                            title: `${stmt.kind}-${name}-${stmt.key.name}`,
                            name: stmt.key.name,
                            prototype: stmt.kind.substr(0, 3) + ' ' + name + '::' + stmt.key.name + script.substring(stmt.value.range[0], stmt.value.body.range[0]),
                            comment: cmt
                        });
                        methodsFound++;
                    }
                }
            }
        }

        function onExportVariableDecl(decl, name) {
            decl.exported = true;
            let comment = decl.comment;
            let init = decl.init, literal = init && init.type === Syntax.Literal;
            if (!comment) {
                comment = {};
                if (literal) {
                    comment.type = '{' + typeof decl.init.value + '}';
                } else if (init) {
                    if (init.type === Syntax.ObjectExpression) {
                        comment.type = '{object}'
                    } else if (init.type === Syntax.ArrayExpression) {
                        comment.type = '{array}'
                    }
                }
            }

            (decl.kind === 'const' ? consts : variables).push({
                name: name,
                comment: comment,
                value: literal ? decl.init.raw : null
            });
        }

        function splitComment(comment) {
            let parts = {};
            let lines = comment.split(/\r?\n +\*/);
            if (lines[0] === '' || lines[0] === '*') lines.shift();
            let prev = 'description', cache = '';
            for (let i = 0, L = lines.length; i < L; i++) {
                let line = lines[i], m = / @(\w+) ?/.exec(line);
                if (m) {
                    onPart();
                    prev = m[1];
                    cache = line.substr(m[0].length);
                } else {
                    cache += '\n' + line;
                }
            }
            onPart();
            return parts;
            function onPart() {
                if (prev === 'param') {
                    if (prev in parts) {
                        parts[prev].push(cache);
                    } else {
                        parts[prev] = [cache]
                    }
                } else {
                    parts[prev] = cache;
                }
            }
        }
    }

}
