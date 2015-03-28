'use strict';

var through2 = require('through2');

module.exports = function concat(stream, cb) {
    var chunks = [];
    stream
        .on('end', function () {
            cb(null, Buffer.concat(chunks));
        })
        .pipe(through2(function (chunk, enc, cb) {
            chunks.push(chunk);
            cb();
        }));
};
