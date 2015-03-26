'use strict';

var fs = require('fs');

module.exports = function isFile(x, callback) {
    fs.stat(x, function (err, stat) {
        var result = false;

        if (err) {
            if (err.code !== 'ENOENT') {
                callback(err, null);
                return;
            }
        } else {
            result = stat.isFile();
        }

        callback(null, result);
    });
};
