var test = require('tape');
var File = require('vinyl');
var path = require('path');
var vm = require('vm');
var yarb = require('../');

test('requiring the same file more than once', function (t) {
    t.plan(1);

    yarb([], {basedir: __dirname})
        .add([
            new File({
                path: '/fake/path/index.js',
                contents: new Buffer(
                    'foo = require("./lib.js").foo;' +
                    'bar = require("./lib.js").bar;'
                )
            })
        ])
        .require([
            new File({
                path: '/fake/path/lib.js',
                contents: new Buffer('module.exports = {foo: 1, bar: 2};')
            })
        ])
        .bundle(function (err, buf) {
            var context = {};
            vm.runInNewContext(buf.toString(), context);
            t.deepEquals(context, {foo: 1, bar: 2});
        });
});

test('multiple externals to the same bundle', function (t) {
    t.plan(7);

    var Resolver = require('../src/resolver');
    var _resolve = Resolver.prototype.resolve;
    var calls = [];

    Resolver.prototype.resolve = function () {
        calls.push({id: arguments[0], sourceFile: path.relative(__dirname, arguments[1])});
        return _resolve.apply(this, arguments);
    };

    var a = yarb('./bundle/a.js', {basedir: __dirname});
    var b = yarb('./bundle/b.js', {basedir: __dirname}).external(a);
    var c = yarb('./bundle/c.js', {basedir: __dirname}).external(a);

    var completed = 0;
    function done() {
        completed++;
        if (completed === 2) {
            // ./d should only be resolved once
            t.equals(calls.length, 3);
            t.deepEquals(calls[0], {id: './d', sourceFile: 'bundle/a.js'});
            t.equals(calls[1].id, './a');
            t.equals(calls[2].id, './a');

            // these can sometimes end up in c, b order
            var b_or_c = /^bundle\/[bc]\.js$/;
            t.ok(calls[1].sourceFile !== calls[2].sourceFile);
            t.ok(b_or_c.test(calls[1].sourceFile));
            t.ok(b_or_c.test(calls[2].sourceFile));

            Resolver.prototype.resolve = _resolve;
        }
    }

    // execute both in the same call stack to see how resolves are minimized
    b.bundle(done);
    c.bundle(done);
});
