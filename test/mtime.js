var test = require('tape');
var File = require('vinyl');
var path = require('path');
var yarb = require('../');

test('files are reread when mtime changes', function (t) {
    t.plan(1);

    var vinyl = new File({
        path: path.resolve(__dirname, './mtime/a.js'),
        contents: new Buffer('module.exports = 123;')
    });

    var bundle = yarb(vinyl, {basedir: __dirname});

    bundle.bundle(function () {
        --vinyl.stats.mtime; // pretend file is older than it is

        bundle.bundle(function () {
            t.equals(vinyl.contents.toString(), 'module.exports = 456;\n');
        });
    });
});
