var test = require('tape');
var File = require('vinyl');
var vm = require('vm');
var yarb = require('../');

test('buffer', function (t) {
    t.plan(1);

    var b = yarb(new File({
        path: '/not/really/a/path',
        contents: new Buffer('hi = false;')
    }));

    b.bundle(function (err, buf) {
        var context = {};
        vm.runInNewContext(buf.toString(), context);
        t.deepEquals(context, {hi: false});
    });
});
