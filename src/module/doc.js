import * as file from 'file.js';

const esprima = require('../esprima.js'),
    Syntax = esprima.Syntax,
    path = require('path');

const parseOption = {
    sourceType: 'module',
    range: true,
    comment: true
};

export default function (outDir, format) {
    process.chdir('src/module');
    //console.log(outDir, format);
    onDir('.');

    function onDir(dir) {
        for (let name of file.readdir(dir)) {
            name = path.join(dir, name);
            if (file.isDirectory(name)) {
                onDir(name);
            } else if (name.substr(name.length - 3) === '.js') {
                onFile(name);
            }
        }
    }

    function onFile(name) {
        console.log(name);
        let ast = esprima.parse(file.read(name).toString('utf8'), parseOption),
            comments = ast.comments, nextComment = 0, lastComment = comments.length;

        let requires = [], exports = [];
        let lastEnd = 0;
        for (let stmt of ast.body) {
            if (stmt.type === Syntax.ExportNamedDeclaration) {
                let comment = findCommentBetween(lastEnd, stmt.range[0]);
                let decl = stmt.declaration;
                if (decl) { // export var | export function
                    if (decl.type == Syntax.FunctionDeclaration) {
                    } else if (decl.type === Syntax.VariableDeclaration) {
                    }
                } else { // export {xxx}
                    for (let spec of stmt.specifiers) {
                    }
                }
            }
            lastEnd = stmt.range[1];
        }

        function findCommentBetween(start, end) {
            console.log('find comment between', start, end)
            let found;
            while (nextComment < lastComment) {
                let comment = comments[nextComment];
                if (comment.range[0] < start) {
                    nextComment++;
                    continue;
                }

                if (comment.range[0] >= start && comment.range[1] <= end) {
                    found = comment;
                }
            }
        }
    }
}

