import * as view from '../src/module/view';

import Handlebars from '../src/module/handlebars';

let h = view.engine(Handlebars.fast_compile);

console.log(h('test/extra/test.handlebars', [{name: 'John'}]) + '');
console.log(h('test/extra/test.handlebars', [{name: 'Jack. 李'}]) + '');