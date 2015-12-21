var path = require('path');
var test = require('tape');
var yarb = require('../');

test('sourcemaps are outputted if the debug option is enabled', function (t) {
    t.plan(1);

    yarb(['./sourcemaps/a.js', './sourcemaps/b.js'], {basedir: __dirname, debug: true})
        .bundle(function (err, buf) {
            t.ok(/\/\/# sourceMappingURL=/.test(buf.toString()));
        });
});
