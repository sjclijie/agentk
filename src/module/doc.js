"use strict";

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

export default function (outDir, format) {
    process.chdir('src/module');
    //console.log(outDir, format);

    let cssFile = path.join(outDir, 'doc.css');
    const template = require('ejs').compile(file.read(path.join(__dirname, '../../doc/doc_template.' + (format === 'html' ? 'ejs' : format))).toString('utf8'));
    file.mkParentDir(cssFile);
    if (format === 'html') {
        let cssInput = path.join(__dirname, '../../doc/doc.css'),
            cssContent = file.read(cssInput),
            checksum = md5(cssContent);
        if (!file.exists(cssFile) || Buffer.compare(md5(cssContent), md5(file.read(cssFile)))) {
            file.write(cssFile, cssContent);
        }
    }
    onDir('.');

    function onDir(dir) {
        for (let name of file.readdir(dir)) {
            name = path.join(dir, name);
            if (file.isDirectory(name)) {
                onDir(name);
            } else if (name.substr(name.length - 3) === '.js') {
                let namespace = name.substr(0, name.length - 3).replace(/[\/\\]/g, '_'),
                    output = path.join(outDir, namespace + '.' + format);
                let fileContent = file.read(name),
                    checksum = md5(fileContent, 'hex');
                if (file.exists(output)) {
                    if (file.read(output).slice(0, 46).toString('binary') === `<!-- @rev ${checksum} -->`) {
                        // docfile is up to date
                        //console.log(name, 'up to date');
                        // return
                    }
                }
                let module = onFile(fileContent, name);
                if (!module) return;
                module.namespace = namespace;
                module.checksum = checksum;
                file.write(output, template(module));
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


        let stmts = ast.body;

        // rearrange comments and statements
        for (let nextStmt = 0, lastStmtEnd = 0, comments = ast.comments, nextComment = 0, lastComment = comments.length;
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
        //console.log(name, stmts);

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
                if (decl) { // export var | export function
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
                }
            } else if (stmt.type === Syntax.FunctionDeclaration) {
                decls[stmt.id.name] = stmt;
                stmt.comment = previousComment(i);
            } else if (stmt.type === Syntax.VariableDeclaration) {
                for (let vardecl of stmt.declarations) {
                    vardecl.kind = stmt.kind;
                    decls[vardecl.id.name] = vardecl;
                }
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
                module._default = {
                    type: 'function',
                    comment: hasDefault.comment
                };
            } else if (hasDefault.type === Syntax.VariableDeclarator) {
                module._default = {
                    type: 'variable',
                    kind: hasDefault.kind
                }
            } else if (hasDefault.type === Syntax.Literal) { // expression
                console.log(name, 'has default', hasDefault);
                module._default = {
                    type: 'literal',
                    valueType: '{' + typeof hasDefault.value + '}',
                    raw: hasDefault.raw
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
        function onExportFunctionDecl(decl, name) {
            methods.push({
                name: name,
                prototype: script.substring(decl.range[0], decl.body.range[0]),
                comment: decl.comment || {}
            })
        }

        function onExportVariableDecl(decl, name) {
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
            comment = comment.replace(/\r?\n \* @(\w+)\s*(.*)/g, function (m, name, val) {
                if (name === 'param') { // array
                    if (name in parts) {
                        parts[name].push(val);
                    } else {
                        parts[name] = [val]
                    }
                } else {
                    parts[name] = val;
                }
                return ''
            });
            parts.description = comment.replace(/^\*/, '').replace(/\r?\n \*/g, '\n');
            return parts;
        }
    }

}

