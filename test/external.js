var fs = require('fs');
var test = require('tape');
var yarb = require('../');

test('external', function (t) {
    t.plan(2);

    var b1 = yarb('external/bundle1.js');
    var b2 = yarb('external/bundle2.js').external(b1);

    b1.bundle(function (err, buf) {
        t.ok(buf.equals(fs.readFileSync('external/output1.js')));
    });

    b2.bundle(function (err, buf) {
        t.ok(buf.equals(fs.readFileSync('external/output2.js')));
    });
});

test('external, reversed bundle order', function (t) {
    t.plan(2);

    var b1 = yarb('external/bundle1.js');
    var b2 = yarb('external/bundle2.js').external(b1);

    b2.bundle(function (err, buf) {
        t.ok(buf.equals(fs.readFileSync('external/output2.js')));
    });

    b1.bundle(function (err, buf) {
        t.ok(buf.equals(fs.readFileSync('external/output1.js')));
    });
});
