'use strict';

var assign = require('object-assign');
var fs = require('fs');
var path = require('path');
var stream = require('stream');
var concat = require('./util/concat');

function readFile(bundle, file, cb) {
    fs.stat(file.path, function (err, stats) {
        if (err) {
            if (err.code !== 'ENOENT' || file.isNull()) {
                // only allow files to not exist on disk if a buffer/stream is provided
                cb(err, null);
            } else if (fileNeedsRead(bundle, file)) {
                cb(null, file.contents);
            } else {
                transformContents(bundle, file, cb);
            }
        } else if (!file.stats || file.stats.mtime < stats.mtime) {
            // always assume the contents have changed
            assign(file, {stats: stats, _deps: {}, _transformed: false});
            transformContents(bundle, file, cb);
        } else {
            // mtime hasn't changed, return cached buffer
            cb(null, file.contents);
        }
    });
};

function fileNeedsRead(bundle, file) {
    return file._transformed || (!bundle._transforms.length && file.isBuffer());
}

function transformContents(bundle, file, cb) {
    var contents = contentsToStream(file).on('error', cb);

    var isExternal = Object.keys(bundle._entries).some(function (entry) {
        return path.relative(path.dirname(entry), file.path).split(path.sep).indexOf('node_modules') >= 0;
    });

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

    concat(contents, function (err, buf) {
        assign(file, {contents: buf, _transformed: true});
        cb(null, buf);
    });
}

function contentsToStream(file) {
    if (file.isStream()) {
        return file.contents;
    } else if (file.isBuffer()) {
        // it'll be converted back to a buffer, but transforms require streams
        return bufferToStream(file.contents);
    } else {
        return fs.createReadStream(file.path);
    }
}

function bufferToStream(buffer) {
    var rs = new stream.Readable();
    rs._read = rs.push.bind(rs, buffer);
    return rs;
}

module.exports = readFile;
