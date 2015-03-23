var stream = require('stream');

module.exports = function (buffer) {
    var rs = new stream.Readable();

    rs._read = function () {
        this.push(buffer);
    };

    return rs;
};
