exports = module.exports = {
    StringTemplate: false,
    Class: false,
    Rest: false
};

try {
    exports.StringTemplate = (0, eval)('`${1 + 2}`') !== '3';
} catch (e) {
    exports.StringTemplate = true
}

try {
    (0, eval)('(class{})');
} catch (e) {
    exports.Class = true;
}

try {
    (0, eval)('(function(...a){})');
} catch (e) {
    exports.Rest = true;
}