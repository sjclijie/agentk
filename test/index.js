"use strict";
require('../src/es6-module-loader');

var assert = require('assert'),
    assertEqual = assert.strictEqual;


let a = System.module('export let a=1234; export let b;' +
    ' export function c(x) {b=x}' +
    ' export function d() {return b}' +
    ' export default 0');
console.log('test module a');

assertEqual(a.a, 1234);

let rnd = Math.random();

a.c(rnd);
assertEqual(a.b, rnd);
assertEqual(a.d(), rnd);

assertEqual(a[Symbol.for('default')], 0);

System.set('a', a);

let b = System.module('import zero, * as a from "a";' +
    ' export function getA() {return a}' +
    ' export function getDefault() {return zero}');
setTimeout(function() {
	console.log('test module b');
	assertEqual(b.getA(), a);
	assertEqual(b.getDefault(), 0);
})
