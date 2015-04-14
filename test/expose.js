var File = require('vinyl');
var fs = require('fs');
var path = require('path');
var test = require('tape');
var vm = require('vm');
var eqFile = require('./util/eqFile');
var yarb = require('../');

test('expose', function (t) {
    t.plan(2);

    var b1 = yarb('expose/bundle1.js', {basedir: __dirname}).expose('expose/shim.js', 'shim');
    var b2 = yarb('expose/bundle2.js', {basedir: __dirname}).external(b1);

    b1.bundle(function (err, buf) {
        eqFile(t, buf, path.resolve(__dirname, 'expose/output1.js'));
    });

    b2.bundle(function (err, buf) {
        eqFile(t, buf, path.resolve(__dirname, 'expose/output2.js'));
    });
});

test('expose with a vinyl object', function (t) {
    t.plan(1);

    var shim = new File({
        path: '/fake/path',
        contents: new Buffer('module.exports = 123;')
    });

    var b1 = yarb(shim, {basedir: __dirname}).expose(shim, 'shim');

    var b2 = yarb(new File({
        path: '/another/fake/path',
        contents: new Buffer("shim = require('shim');")
    }), {basedir: __dirname}).external(b1);

    b1.bundle(function (err, buf1) {
        b2.bundle(function (err, buf2) {
            var context = {};
            vm.runInNewContext(buf1.toString() + buf2.toString(), context);
            t.equals(context.shim, 123);
        });
    });
});

test('expose within a single bundle', function (t) {
    t.plan(1);

    var b = yarb(new File({
        path: '/fake/path',
        contents: new Buffer('shim = require("shim")')
    }), {basedir: __dirname});

    b.expose('expose/shim.js', 'shim');

    b.bundle(function (err, buf) {
        var context = {};
        vm.runInNewContext(buf.toString(), context);
        t.deepEquals(context, {shim: 'shim'});
    });
});

test('expose with a dynamically-required id', function (t) {
    t.plan(1);

    var shim = new File({
        path: '/fake/path',
        contents: new Buffer('module.exports = 123;')
    });

    var b1 = yarb(shim, {basedir: __dirname}).expose(shim, 'shim');

    var b2 = yarb(new File({
        path: '/another/fake/path',

        // this can't be statically analyzed, but the .require() and
        // .external() below should allow it to be found at runtime
        contents: new Buffer("shim = require('sh' + 'im');")

    }), {basedir: __dirname}).require(shim).external(b1);

    b1.bundle(function (err, buf1) {
        b2.bundle(function (err, buf2) {
            var context = {};
            vm.runInNewContext(buf1.toString() + buf2.toString(), context);
            t.equals(context.shim, 123);
        });
    });
});

test('expose across chained bundles', function (t) {
    t.plan(1);

    var b1 = yarb([], {basedir: __dirname}).expose('./expose/shim.js', 'shim');
    var b2 = yarb([], {basedir: __dirname}).external(b1);

    var b3 = yarb(new File({
        path: '/fake/path',
        contents: new Buffer("shim = require('shim')")
    }), {basedir: __dirname}).external(b2);

    b1.bundle(function (err, buf1) {
        b2.bundle(function (err, buf2) {
            b3.bundle(function (err, buf3) {
                var context = {};
                vm.runInNewContext(buf1.toString() + buf2.toString() + buf3.toString(), context);
                t.equals(context.shim, 'shim');
            });
        });
    });
});
