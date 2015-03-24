var test = require('tape');
var File = require('vinyl');
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
