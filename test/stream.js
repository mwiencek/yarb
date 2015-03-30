var stream = require('stream');
var test = require('tape');
var File = require('vinyl');
var vm = require('vm');
var yarb = require('../');

test('stream', function (t) {
    t.plan(1);

    var module = 'hi = false;';
    var position = 0;
    var rs = new stream.Readable();

    rs._read = function () {
        if (position < module.length - 1) {
            this.push(module[position++]);
        } else {
            this.push(null);
        }
    };

    var b = yarb(new File({
        path: '/not/really/a/path',
        contents: rs
    }), {basedir: __dirname});

    b.bundle(function (err, buf) {
        var context = {};
        vm.runInNewContext(buf.toString(), context);
        t.deepEquals(context, {hi: false});
    });
});
