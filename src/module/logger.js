/**
 * Helper for log writing
 *
 * @title Logging helper
 *
 * @example
 *
 *     import * as logger from 'module/logger';
 *
 *     logger.level = logger.INFO;
 *     logger.format.info = '[$level] $datetime $($1.method) $($1.pathname) $($2.status) $0\n'
 *     logger.output.info = 'log/info.log'
 *     logger.info('lorem ipsum', req, res)
 *
 */

const _fs = require('fs');


const _defaultDatetimeFormat = 'yyyy-MM-dd HH:mm:ss', _defaultLogFormat = '[$level] $datetime $0\n';
/**
 * formats of each log level.
 * Some variables can be used in the log format:
 *
 *   - `$level` current log level, like: `DEBUG INFO WARN ERROR FATAL`
 *   - `$datetime` datetime in format `yyyy-MM-dd HH:mm:ss`
 *   - `$filename` source file from which the logger method is called
 *   - `$line` line number of the source file from which the logger method is called
 *   - `$column` column number of the source file from which the logger method is called
 *   - `$method` method name from which the logger method is called
 *   - `$0` `$1` ... parameters to the log method
 *   - `$(xxxx)` js expression evaluated to get a field from a variable
 *
 * Format of the datetime parameter can be specified like: `$datetime{yyyy/MM/dd HH:mm:ss.SSS}`, tokens which can be
 * used in the datetime formatter are:
 *
 *   - `yyyy` 4-digits years, like 2015
 *   - `MM` 2-digits months, like 01, 02, ..., 12
 *   - `MMM` 3-characters month name, like Jan, Feb, ..., Dec
 *   - `dd` 2-digits date, like 01, 02, ..., 31
 *   - `DDD` 3-characters day name of week, like Sun, Mon, ..., Sat
 *   - `HH` 2-digits hours in 24-hours
 *   - `mm` 2-digits minutes
 *   - `ss` 2-digits seconds
 *   - `SSS` 3-digits milliseconds
 *
 * Default formats for each log levels are `'[$level] $datetime $0\n'`, which will print the log level, the datetime and the
 * first argument.
 *
 * A log method should not be called before its format and output parameter is set up
 *
 * @type Object
 */
export const format = {
    verbose: _defaultLogFormat,
    debug: _defaultLogFormat,
    info: _defaultLogFormat,
    warn: _defaultLogFormat,
    error: _defaultLogFormat,
    fatal: _defaultLogFormat
};

/**
 * Output targets
 *
 * @type Object
 * specify a filename or a stream
 */
export const output = {
    verbose: process.stdout,
    debug: process.stdout,
    info: process.stdout,
    warn: process.stdout,
    error: process.stderr,
    fatal: process.stderr
};

export const VERBOSE = 8, DEBUG = 7, INFO = 6, WARN = 4, ERROR = 3, FATAL = 0;

/**
 * current log level. The log levels that has lower priority will be ignored.
 * @type {number}
 */
export let level = INFO;

function logger(_level, name) {
    return function () { // first called
        if (_level > level) {// ignored
            module[name] = noop;
            return
        }

        // parse format
        let _output = output[name];

        const stackFields = {$method: 1, $filename: 2, $line: 3, $column: 4};

        let _format = format[name], reg = /\$(?:level|datetime(?:\{.*?\})?|filename|line|column|method|\d+|\()/,
            code = 'var msg=""',
            requiresStack = false,
            firstMsg, // first message to write when requiresStack set to true
            requiresTime = false,
            maxVars = 0,
            m;
        while (m = _format.match(reg)) {
            let matched = m[0];
            append(_format.substr(0, m.index));
            _format = _format.substr(m.index + matched.length);

            if (matched === '$level') {
                append(name.toUpperCase());
            } else if (matched === '$method' || matched === '$filename' || matched === '$line' || matched === '$column') {
                requiresStack = true;
                code += '+_stack[' + stackFields[matched] + ']';
            } else if (matched.substr(0, 9) === '$datetime') {
                requiresTime = true;
                let format = matched.length === 9 ? _defaultDatetimeFormat : matched.substring(10, matched.length - 1);
                const dateCodes = {
                    'yyyy-MM-dd': '0,10',
                    'yyyy': '0,4',
                    'MM': '5,2',
                    'dd': '8,2',
                    'MMM': '28,3',
                    'DDD': '24,3',
                    'HH:mm:ss': '11,8',
                    'HH': '11,2',
                    'hh': '11,2',
                    'mm': '14,2',
                    'ss': '17,2',
                    'SSS': '20,3'
                };
                code += '+' + JSON.stringify(format).replace(/yyyy-MM-dd|HH:mm:ss|yyyy|MM|dd|MMM|DDD|HH|mm|ss|SSS/g, function (field) {
                        return '"+_ts.substr(' + dateCodes[field] + ')+"';
                    }).replace(/""\+|\+""/g, '');
            } else if (matched === '$(') {
                // match to next quote
                let opened = 1, rQuote = /[()]/g, m1, endOfExpr;
                while (m1 = rQuote.exec(_format)) {
                    if (m1[0] === '(') {
                        opened++;
                    } else {
                        opened--;
                        if (!opened) {
                            endOfExpr = m1.index + 1;
                            break;
                        }
                    }
                }
                if (opened) {// nothing to match
                    throw new Error('end closing not match')
                }
                let codeParts = _format.substr(0, endOfExpr), rVars = /\$(\d+)\b/g;
                while (m1 = rVars.exec(codeParts)) {
                    let varNum = m1[1] | 0;
                    if (varNum >= maxVars)maxVars = varNum + 1;
                }
                code += '+(' + _format.substr(0, endOfExpr);
                _format = _format.substr(endOfExpr);
            } else {
                code += '+' + matched;
                let varNum = matched.substr(1) | 0;
                if (varNum >= maxVars)maxVars = varNum + 1;
            }

        }
        if (_format) {
            append(_format)
        }
        let argNames = '';
        for (let i = 0; i < maxVars; i++) {
            argNames += ',$' + i
        }
        argNames = argNames.substr(1);

        if (requiresTime) {
            code = 'var _t = new Date(),_ts = new Date(+_t-_t.getTimezoneOffset()*60e3).toJSON()+_t.toDateString();' + code
        }
        if (requiresStack) {// first call
            let _stack = /\n    at ([^\(]*) \((.*):(\d+):(\d+)\)|\n    at (.*):(\d+):(\d+)/.exec(new Error().stack.substr(12));
            if (_stack[1] === undefined) {
                _stack = _stack.slice(3);
                _stack[1] = "<scope script>"
            }
            firstMsg = Function(argNames, 'var _stack=this;' + code + ';return msg').apply(_stack, arguments);

            code = 'var _stack=/\\n    at ([^\\(]*) \\((.*):(\\d+):(\\d+)\\)|\\n    at (.*):(\\d+):(\\d+)/.exec(new Error().stack.substr(12));' +
                'if(_stack[1]===undefined){_stack=_stack.slice(3);_stack[1]="<scope script>"}' + code;
        }
        //console.log(code);
        let formatter = Function('write', 'return function(' + argNames + '){' + code + ';write(msg)}'), writer;
        if (typeof _output === 'string') { // write to file
            writer = filenameWriter(_output);
        } else if (typeof _output === 'number') { // fd
            writer = fdWriter(_output);
        } else { // stream
            writer = streamWriter(_output);
        }
        let func = module[name] = formatter(writer);

        // call for the first time
        if (requiresStack) {
            writer(firstMsg)
        } else {
            func.apply(module, arguments);
        }


        function append(str) {
            str = JSON.stringify(str);
            if (code[code.length - 1] === '"') {
                code = code.substr(0, code.length - 1) + str.substr(1);
            } else {
                code += '+' + str;
            }
        }


    }
}

function noop() {
}

function filenameWriter(filename) {
    let fd = _fs.openSync(filename, 'a');
    let handle = bufferedWriter(fd),
        setFd = handle.setFd;
    _fs.watch(filename, function (action) {
        if (action === 'rename') {
            _fs.close(fd);
            setFd(fd = _fs.openSync(filename, 'a'))
        }
    });

    return handle.write;
}


function fdWriter(fd) {
    return bufferedWriter(fd).write
}

function streamWriter(stream) {
    return function (str) {
        stream.write(str);
    }
}

function bufferedWriter(fd) {
    let buffer = '';

    return {
        setFd(_fd) {
            fd = _fd
        },
        write(str){
            if (buffer) {
                buffer += str;
            } else {
                buffer = str;
                setTimeout(write, 300)
            }
        }
    };

    function write() {
        _fs.write(fd, buffer, null, 'utf8', function (err) {
            if (err) { // write failed
                console.log('logger::bufferedWriter: write failed:' + err.message);
            }
            buffer = '';
        });
    }
}

/**
 * log method that will format the arguments into a string and write them into output
 *
 * @method
 *
 * @type {Function}
 */
export let verbose = logger(VERBOSE, 'verbose'),
    debug = logger(DEBUG, 'debug'),
    info = logger(INFO, 'info'),
    warn = logger(WARN, 'warn'),
    fatal = logger(FATAL, 'fatal');