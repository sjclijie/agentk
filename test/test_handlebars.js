import * as view from '../src/module/view';

let h = view.engine(require('handlebars').compile);

console.log(h('test/extra/test.handlebars', {
    list: [{name: 'John'}]
}));
console.log(h('test/extra/test.handlebars', {
    list: [{name: 'Jack'}]
}));