var test = require('tape');
var vm = require('vm');
var yarb = require('../');

test('requiring json files', function (t) {
    t.plan(2);

    function callback(err, buf) {
        var context = {};
        vm.runInNewContext(buf.toString(), context);
        t.deepEquals(context.json, {"require('foo')": "hehehe"});
    }

    yarb('./json/b.js', {basedir: __dirname}).bundle(callback);

    // extensionless require()
    yarb('./json/c.js', {basedir: __dirname}).bundle(callback);
});
