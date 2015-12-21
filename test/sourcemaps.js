var path = require('path');
var test = require('tape');
var yarb = require('../');
var eqFile = require('./util/eqFile');

test('sourcemaps are outputted if the debug option is enabled', function (t) {
    t.plan(1);

    yarb(['./sourcemaps/a.js', './sourcemaps/b.js'], {basedir: __dirname, debug: true})
        .bundle(function (err, buf) {
            eqFile(t, buf, path.resolve(__dirname, 'sourcemaps/output.js'));
        });
});
