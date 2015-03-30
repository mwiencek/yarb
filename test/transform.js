var bufferEqual = require('buffer-equal');
var envify = require('envify/custom');
var fs = require('fs');
var path = require('path');
var test = require('tape');
var yarb = require('../');

test('transform', function (t) {
    t.plan(1);

    yarb('./transform/input1.js', {basedir: __dirname})
        .transform(envify({foo: 'bar'}))
        .bundle(function (err, buf) {
            t.ok(bufferEqual(buf, fs.readFileSync(path.resolve(__dirname, './transform/output1.js'))));
        });
});

test('global setting', function (t) {
    t.plan(2);

    yarb('./transform/input2.js', {basedir: __dirname})
        .transform(envify({NODE_ENV: 'production'}))
        .bundle(function (err, buf) {
            t.ok(bufferEqual(buf, fs.readFileSync(path.resolve(__dirname, './transform/output2.js'))));
        });

    yarb('./transform/input2.js', {basedir: __dirname})
        .transform(envify({NODE_ENV: 'production'}), {global: true})
        .bundle(function (err, buf) {
            t.ok(bufferEqual(buf, fs.readFileSync(path.resolve(__dirname, './transform/output2-global.js'))));
        });
});
