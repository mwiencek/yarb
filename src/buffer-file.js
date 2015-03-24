'use strict';

var concat = require('concat-stream');
var fs = require('fs');
var Q = require('q');
var bufferStream = require('./buffer-stream.js');

function bufferFile(bundle, file) {
    var promise = bundle._buffering.get(file.path);
    if (promise) {
        return promise;
    }

    promise = Q.Promise(function (resolve, reject) {
        fs.stat(file.path, function (err, stats) {
            if (err) {
                if (err.code !== 'ENOENT' || file.isNull()) {
                    // only allow files to not exist on disk if a buffer/stream is provided
                    reject(err);
                } else if (file._transformed || (!bundle._transforms.length && file.isBuffer())) {
                    // nothing we need to re-read or transform
                    resolve(file);
                } else {
                    readFileContentsToBuffer(bundle, file).then(resolve, reject);
                }
            } else {
                var oldStats = file.stats;
                file.stats = stats;

                if (!oldStats || oldStats.mtime < stats.mtime) {
                    // always assume the contents have changed
                    file._deps = {};
                    file._transformed = false;

                    readFileContentsToBuffer(bundle, file).then(resolve, reject);
                } else {
                    // mtime hasn't changed, return cached buffer
                    resolve(file);
                }
            }
            bundle._buffering.delete(file.path);
        });
    });

    bundle._buffering.set(file.path, promise);
    return promise;
};

function readFileContentsToBuffer(bundle, file) {
    var stream = contentsToStream(file);

    bundle._transforms.forEach(function (args) {
        var transform = args[0];

        if (typeof transform === 'string') {
            transform = require(transform);
        }

        stream = stream.pipe(transform.apply(null, [file.path].concat(args.slice(1))));
    });

    return Q.Promise(function (resolve, reject) {
        stream.on('error', reject).pipe(concat(function (buf) {
            file.contents = buf;
            file._transformed = true;
            resolve(file);
        }));
    });
}

function contentsToStream(file) {
    if (file.isStream()) {
        return file.contents;
    } else if (file.isBuffer()) {
        // it'll be converted back to a buffer, but transforms require streams
        return bufferStream(file.contents);
    } else {
        return fs.createReadStream(file.path);
    }
}

module.exports = bufferFile;