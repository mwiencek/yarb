'use strict';

var fs = require('fs');
var path = require('path');
var either = require('./either');
var loadAsFile = require('./loadAsFile');

function tryIndexFile(x, cb) {
    loadAsFile(path.join(x, 'index'), cb);
}

module.exports = function loadAsDirectory(x, cb) {
    fs.readFile(path.join(x, 'package.json'), function (err, buf) {
        if (err) {
            if (err.code === 'ENOENT') {
                tryIndexFile(x, cb);
            } else {
                cb(err, null);
            }
            return;
        }

        var contents;
        try {
            contents = JSON.parse(buf.toString());
        } catch (e) {
            cb(e, null);
            return;
        }

        if (contents.main) {
            loadAsFile(path.join(x, contents.main), either(cb, tryIndexFile.bind(null, x, cb)));
        } else {
            tryIndexFile(x, cb);
        }
    });
};
