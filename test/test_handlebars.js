import handlebars from '../src/module/handlebars';

let h = handlebars();

console.log(h('test/extra/test.handlebars', {
    list: [{name: 'John'}]
}));
console.log(h('test/extra/test.handlebars', {
    list: [{name: 'Jack'}]
}));