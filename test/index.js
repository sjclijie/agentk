require('../');

System.import(require('path').join(__dirname, 'test.js')).then(function (module) {

}, function (err) {
    console.error("ERROR", err.stack || err.message || err);
});