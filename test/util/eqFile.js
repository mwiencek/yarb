'use strict';

var fs = require('fs');

module.exports = function bufferEqFile(t, buf, filename) {
    fs.readFile(filename, function (err, fileBuf) {
        t.equals(buf.toString(), fileBuf.toString());
    });
};
