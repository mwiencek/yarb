'use strict';

var File = require('vinyl');
var fs = require('fs');
var first = require('../util/first');
var noError = require('../util/noError');

module.exports = function loadAsFile(x, bundle, cb) {
    getFile(x, bundle, noError(cb, function (file) {
        if (file) {
            cb(null, file);
        } else {
            getFile(x + '.js', bundle, noError(cb, function (file) {
                if (file) {
                    cb(null, file);
                } else {
                    getFile(x + '.json', bundle, noError(cb, function (file) {
                        cb(null, file || null);
                    }));
                }
            }));
        }
    }));
};

function getFile(x, bundle, cb) {
    // don't bother running an expensive stat() call to check something that
    // was explicitly added to the bundle. if it's not actually a file it'll
    // fail later, as it should.
    var file = findInBundle(x, bundle);

    if (file) {
        process.nextTick(function () {
            cb(null, file);
        });
        return;
    }

    fs.stat(x, function (err, stat) {
        if (err && err.code !== 'ENOENT') {
            cb(err, null);
        } else if (!err && stat.isFile()) {
            cb(null, new File({path: x}));
        }  else {
            cb(null, null);
        }
    });
}

function findInBundle(x, bundle) {
    return bundle._files[x] || first(bundle._externals, findInBundle.bind(null, x));
}
