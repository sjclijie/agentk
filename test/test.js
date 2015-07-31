import * as math from 'module/math.js';

let test = new Test("math");
test.test("abs");
test.assertEqual(math.abs(1), 1);
test.assertEqual(math.abs(0), 0);
test.assertEqual(math.abs(-1), 1);
test.assertEqual(math.abs(NaN), NaN);