var stream = require('stream');
var test = require('tape');
var File = require('vinyl');
var yarb = require('../');

function badBundle() {
    var rs = new stream.Readable();
    rs._read = function () {this.push(0)};

    return yarb(new File({path: '/a/b/c', contents: rs}));
}

test('callback error', function (t) {
    t.plan(1);

    badBundle().bundle(function (err, buf) {
        t.equals(err.toString(), 'TypeError: Invalid non-string/buffer chunk');
    });
});

test('stream error', function (t) {
    t.plan(1);

    badBundle().bundle().on('error', function (err) {
        t.equals(err.toString(), 'TypeError: Invalid non-string/buffer chunk');
    })
});

test('transform error', function (t) {
    t.plan(1);

    function throws() {
        return new stream.Writable();
    }

    badBundle().transform(throws).bundle().on('error', function (err) {
        t.equals(err.toString(), 'Error: Cannot pipe. Not readable.');
    })
});
