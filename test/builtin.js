var File = require('vinyl');
var test = require('tape');
var vm = require('vm');
var yarb = require('../');

test('buffer builtin', function (t) {
    t.plan(1);

    yarb(new File({
        path: '/fake/path',
        contents: new Buffer('test = new Buffer("a1b2c3");')
    }), {basedir: __dirname}).bundle(function (err, buf) {
        var context = {};
        vm.runInNewContext(buf.toString(), context);
        t.equals(context.test.toString(), 'a1b2c3');
    });
});
