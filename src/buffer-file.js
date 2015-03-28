'use strict';

var assign = require('object-assign');
var fs = require('fs');
var path = require('path');
var through2 = require('through2');
var buffer = require('./buffer');

function bufferFile(bundle, file, cb) {
    fs.stat(file.path, function (err, stats) {
        if (err) {
            if (err.code !== 'ENOENT' || file.isNull()) {
                // only allow files to not exist on disk if a buffer/stream is provided
                cb(err, null);
            } else if (file._transformed || (!bundle._transforms.length && file.isBuffer())) {
                // nothing we need to re-read or transform
                cb(null, file.contents);
            } else {
                readFileContentsToBuffer(bundle, file, cb);
            }
        } else if (!file.stats || file.stats.mtime < stats.mtime) {
            // always assume the contents have changed
            assign(file, {stats: stats, _deps: {}, _transformed: false});
            readFileContentsToBuffer(bundle, file, cb);
        } else {
            // mtime hasn't changed, return cached buffer
            cb(null, file.contents);
        }
    });
};

function readFileContentsToBuffer(bundle, file, cb) {
    var contents = contentsToStream(file).on('error', cb);

    var isExternal = true;
    for (var entry of bundle._entries) {
        if (path.relative(path.dirname(entry), file.path).split(path.sep).indexOf('node_modules') < 0) {
            isExternal = false;
            break;
        }
    }

    bundle._transforms.forEach(function (args) {
        var func = args[0];
        var options = args[1];

        if (!isExternal || (options && options.global)) {
            if (typeof func === 'string') {
                func = require(func);
            }
            contents = contents
                .pipe(func.apply(null, [file.path].concat(args.slice(1))))
                .on('error', cb);
        }
    });

    buffer.stream2buffer(contents, function (err, buf) {
        assign(file, {contents: buf, _transformed: true});
        cb(null, buf);
    });
}

function contentsToStream(file) {
    if (file.isStream()) {
        return file.contents;
    } else if (file.isBuffer()) {
        // it'll be converted back to a buffer, but transforms require streams
        return buffer.buffer2stream(file.contents);
    } else {
        return fs.createReadStream(file.path);
    }
}

module.exports = bufferFile;
