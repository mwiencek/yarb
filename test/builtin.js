var File = require('vinyl');
var test = require('tape');
var vm = require('vm');
var yarb = require('../');

test('buffer builtin', function (t) {
    t.plan(2);

    function callback(err, buf) {
        if (err) {
            t.end();
        } else {
            var context = {};
            vm.runInNewContext(buf.toString(), context);
            t.equals(context.test.toString(), 'a1b2c3');
        }
    }

    // as global
    yarb(new File({
        path: '/fake/path',
        contents: new Buffer('test = new Buffer("a1b2c3");')
    }), {basedir: __dirname}).bundle(callback);

    // as module
    yarb(new File({
        path: '/fake/path',
        contents: new Buffer('test = new (require("buffer").Buffer)("a1b2c3");')
    }), {basedir: __dirname}).bundle(callback);
});

test('util builtin', function (t) {
    t.plan(1);

    yarb(new File({
        path: '/fake/path',
        contents: new Buffer("A = Array; B = function () {}; require('util').inherits(B, A);")
    }), {basedir: __dirname}).bundle(function (err, buf) {
        var context = {};
        vm.runInNewContext(buf.toString(), context);
        t.ok(new context.B() instanceof context.A);
    });
});

test('net builtin', function (t) {
    t.plan(2);

    yarb(new File({
        path: '/fake/path',
        contents: new Buffer(
            "A = require('net').isIPv4('127.0.0.1');\n" +
            "B = require('net').isIPv4('hahahahah');\n"
        )
    }), {basedir: __dirname}).bundle(function (err, buf) {
        var context = {};
        vm.runInNewContext(buf.toString(), context);
        t.equal(context.A, true);
        t.equal(context.B, false);
    });
});
