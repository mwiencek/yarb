'use strict';

var fs = require('fs');

fs.readdir(__dirname, function (err, files) {
    files.forEach(function (file) {
        if (/\.js$/.test(file)) {
            require('./' + file);
        }
    });
});
