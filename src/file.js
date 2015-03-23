'use strict';

var crypto = require('crypto');
var fs = require('fs');
var Q = require('q');
var through2 = require('through2');
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

    var stream;
    if (this.isStream()) {
        stream = this.contents;
    } else if (this.isBuffer()) {
        // it'll be converted back to a buffer, but transforms require streams
        stream = bufferStream(this.contents);
    } else {
        stream = fs.createReadStream(this.path);
    }

    transforms && transforms.forEach(function (args) {
        var transform = args[0];

        if (typeof transform === 'string') {
            transform = require(transform);
        }

        stream = stream.pipe(transform.apply(null, [self.path].concat(args.slice(1))));
    });

    var chunks = [];
    var deferred = Q.defer();

    stream
        .on('error', deferred.reject)
        .on('end', function () {
            self.contents = Buffer.concat(chunks);
            self._transformed = true;
            deferred.resolve(self);
        })
        .pipe(through2(function (chunk, enc, cb) {
            chunks.push(chunk);
            cb();
        }));

    return deferred.promise;
};

function sha1(str) {
    return crypto.createHash('sha1').update(str).digest('hex').substring(0, 7);
}

module.exports = File;
