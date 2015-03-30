var path = require('path');
var test = require('tape');
var yarb = require('../');

test('has', function (t) {
    t.plan(6);

    var b = yarb('./has/a.js', {basedir: __dirname});

    t.ok(b.has('./has/a.js'));
    t.ok(b.has(path.resolve(__dirname, './has/a.js')));

    // info not available until post-bundle
    t.ok(!b.has('./has/b.js'));
    t.ok(!b.has(path.resolve(__dirname, './has/b.js')));

    b.bundle(function () {
        t.ok(b.has('./has/b.js'));
        t.ok(b.has(path.resolve(__dirname, './has/b.js')));
    });
});
