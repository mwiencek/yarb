var stream = require('stream');
var through2 = require('through2');

exports.buffer2stream = function (buffer) {
    var rs = new stream.Readable();

    rs._read = function () {
        this.push(buffer);
    };

    return rs;
};

exports.stream2buffer = function (stream, cb) {
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
