'use strict';

var concat = require('concat-stream');
var crypto = require('crypto');
var fs = require('fs');
var Q = require('q');
var VinylFile = require('vinyl');
var bufferStream = require('./buffer-stream.js');

function File() {
    VinylFile.apply(this, arguments);

    // data piped to browser-pack
    this._hash = sha1(this.path);
    this._deps = {};

    // whether transforms were run
    this._transformed = false;
}

File.prototype = Object.create(VinylFile.prototype);

File.prototype._buffer = function (transforms) {
    var self = this;

    if (this._transformed || (!(transforms && transforms.length) && this.isBuffer())) {
        return Q.Promise(function (resolve) {resolve(self)});
    }

    var stream = contentsToStream(this);
    var deferred = Q.defer();

    if (transforms) {
        transforms.forEach(function (args) {
            var transform = args[0];

            if (typeof transform === 'string') {
                transform = require(transform);
            }

            stream = stream.pipe(transform.apply(null, [self.path].concat(args.slice(1))));
        });
    }

    stream.on('error', deferred.reject).pipe(concat(function (buf) {
        self.contents = buf;
        self._transformed = true;
        deferred.resolve(self);
    }));

    return deferred.promise;
};

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

function sha1(str) {
    return crypto.createHash('sha1').update(str).digest('hex').substring(0, 7);
}

module.exports = File;
