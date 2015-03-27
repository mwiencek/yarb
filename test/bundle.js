var test = require('tape');
var File = require('vinyl');
var path = require('path');
var vm = require('vm');
var yarb = require('../');

test('requiring the same file more than once', function (t) {
    t.plan(1);

    yarb()
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
    t.plan(1);

    var Resolver = require('../src/resolver');
    var _resolve = Resolver.prototype.resolve;
    var calls = [];

    Resolver.prototype.resolve = function () {
        calls.push({id: arguments[0], sourceFile: path.relative('./', arguments[1])});
        return _resolve.apply(this, arguments);
    };

    var a = yarb('./bundle/a.js');
    var b = yarb('./bundle/b.js').external(a);
    var c = yarb('./bundle/c.js').external(a);

    var completed = 0;
    function done() {
        completed++;
        if (completed === 2) {
            t.deepEquals(
                calls,
                [
                    // ./d should only be resolved once
                    {id: './d', sourceFile: 'bundle/a.js'},
                    {id: './a', sourceFile: 'bundle/b.js'},
                    {id: './a', sourceFile: 'bundle/c.js'}
                ]
            );
        }
    }

    // execute both in the same call stack to see how resolves are minimized
    b.bundle(done);
    c.bundle(done);
    Resolver.prototype.resolve = _resolve;
});
