var bufferEqual = require('buffer-equal');
var fs = require('fs');
var path = require('path');
var test = require('tape');
var yarb = require('../');

test('external', function (t) {
    t.plan(2);

    var b1 = yarb('external/bundle1.js', {basedir: __dirname}).expose('external/shim.js', 'shim');
    var b2 = yarb('external/bundle2.js', {basedir: __dirname}).external(b1);

    b1.bundle(function (err, buf) {
        t.ok(bufferEqual(buf, fs.readFileSync(path.resolve(__dirname, 'external/output1.js'))));
    });

    b2.bundle(function (err, buf) {
        t.ok(bufferEqual(buf, fs.readFileSync(path.resolve(__dirname, 'external/output2.js'))));
    });
});

test('external, reversed bundle order', function (t) {
    t.plan(2);

    var b1 = yarb('external/bundle1.js', {basedir: __dirname}).expose('external/shim.js', 'shim');
    var b2 = yarb('external/bundle2.js', {basedir: __dirname}).external(b1);

    b2.bundle(function (err, buf) {
        t.ok(bufferEqual(buf, fs.readFileSync(path.resolve(__dirname, 'external/output2.js'))));
    });

    b1.bundle(function (err, buf) {
        t.ok(bufferEqual(buf, fs.readFileSync(path.resolve(__dirname, 'external/output1.js'))));
    });
});

test('implicit external chains', function (t) {
    t.plan(3);

    // b1 provides lib
    var b1 = yarb('external/chain1.js', {basedir: __dirname});

    // b2 explicitly requires lib from b1
    var b2 = yarb('external/chain2.js', {basedir: __dirname}).external(b1);

    // b3 implicitly requires lib from b1 via b2
    var b3 = yarb('external/chain3.js', {basedir: __dirname}).external(b2);

    b1.bundle(function (err, buf) {
        t.ok(bufferEqual(buf, fs.readFileSync(path.resolve(__dirname, 'external/chain-output1.js'))));
    });

    b2.bundle(function (err, buf) {
        t.ok(bufferEqual(buf, fs.readFileSync(path.resolve(__dirname, 'external/chain-output2.js'))));
    });

    b3.bundle(function (err, buf) {
        t.ok(bufferEqual(buf, fs.readFileSync(path.resolve(__dirname, 'external/chain-output3.js'))));
    });
});
