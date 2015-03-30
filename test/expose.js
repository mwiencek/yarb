var bufferEqual = require('buffer-equal');
var File = require('vinyl');
var fs = require('fs');
var path = require('path');
var test = require('tape');
var vm = require('vm');
var yarb = require('../');

test('expose', function (t) {
    t.plan(2);

    var b1 = yarb('expose/bundle1.js', {basedir: __dirname}).expose('expose/shim.js', 'shim');
    var b2 = yarb('expose/bundle2.js', {basedir: __dirname}).external(b1);

    b1.bundle(function (err, buf) {
        t.ok(bufferEqual(buf, fs.readFileSync(path.resolve(__dirname, 'expose/output1.js'))));
    });

    b2.bundle(function (err, buf) {
        t.ok(bufferEqual(buf, fs.readFileSync(path.resolve(__dirname, 'expose/output2.js'))));
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
