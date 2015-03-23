var fs = require('fs');
var test = require('tape');
var yarb = require('../');

test('expose', function (t) {
    t.plan(2);

    var b1 = yarb('expose/bundle1.js').expose('expose/shim.js', 'shim');
    var b2 = yarb('expose/bundle2.js').external(b1);

    b1.bundle(function (err, buf) {
        t.ok(buf.equals(fs.readFileSync('expose/output1.js')));
    });

    b2.bundle(function (err, buf) {
        t.ok(buf.equals(fs.readFileSync('expose/output2.js')));
    });
});
