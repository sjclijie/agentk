import *  as logger from '../../src/module/logger';


logger.format.info = '[$level] $datetime $0 $1 $method $filename $line $column\n';

logger.output.info = 'info.log';
let n = 0;

test();

setInterval(test, 10);

function test() {
    logger.info('hello world', n++);
}