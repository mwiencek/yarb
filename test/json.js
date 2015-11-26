var test = require('tape');
var vm = require('vm');
var yarb = require('../');

test('requiring json files', function (t) {
    t.plan(1);

    var b = yarb('./json/b.js', {basedir: __dirname});

    b.bundle(function (err, buf) {
        var context = {};
        vm.runInNewContext(buf.toString(), context);
        t.deepEquals(context.json, {"require('foo')": "hehehe"});
    });
});
