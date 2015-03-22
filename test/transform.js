var fs = require('fs');
var test = require('tape');
var yarb = require('../');
var through2 = require('through2');

test('transform', function (t) {
    t.plan(1);

    yarb('./transform/input.js')
        .transform(function () {
            return through2(function (chunk, enc, cb) {
                this.push(new Buffer(chunk.toString().replace('process.env.foo', "'bar'")));
                cb();
            })
        })
        .bundle(function (err, buf) {
            t.ok(buf.equals(fs.readFileSync('./transform/output.js')));
        });
});
