'use strict';

var assign = require('object-assign');
var fs = require('fs');
var path = require('path');
var Promise = require('promise');
var through2 = require('through2');
var bufferStream = require('./buffer-stream.js');

function bufferFile(bundle, file) {
    var promise = bundle._buffering.get(file.path);
    if (promise) {
        return promise;
    }

    promise = new Promise(function (resolve, reject) {
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
            } else if (!file.stats || file.stats.mtime < stats.mtime) {
                // always assume the contents have changed
                readFileContentsToBuffer(
                    bundle,
                    assign(file, {stats: stats, _deps: {}, _transformed: false})
                ).then(resolve, reject);
            } else {
                // mtime hasn't changed, return cached buffer
                resolve(file);
            }
        });
    });

    bundle._buffering.set(file.path, promise);
    return promise;
};

function readFileContentsToBuffer(bundle, file) {
    return new Promise(function (resolve, reject) {
        var contents = contentsToStream(file);

        function append(through) {
            contents = contents.on('error', reject).pipe(through);
        }

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
                append(func.apply(null, [file.path].concat(args.slice(1))));
            }
        });

        contents.on('end', function () {
            resolve(assign(file, {contents: Buffer.concat(chunks), _transformed: true}));
        });

        var chunks = [];
        append(through2(function (chunk, enc, cb) {
            chunks.push(chunk);
            cb();
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
