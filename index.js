'use strict';

var bpack = require('browser-pack');
var bresolve = require('browser-resolve');
var clone = require('clone');
var concat = require('concat-stream');
var crypto = require('crypto');
var detective = require('detective');
var fs = require('fs');
var path = require('path');
var Q = require('q');
var sliced = require('sliced');
var stream = require('stream');
var through2 = require('through2');
var VinylFile = require('vinyl');
var bufferStream = require('./src/buffer-stream.js');

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

function getVinyls(files) {
    return [].concat(files).map(getVinyl);
}

function getVinyl(file) {
    if (typeof file === 'string') {
        return new File({path: path.resolve(file)});
    }

    if (!file.path || !path.isAbsolute(file.path)) {
        throw new Error('file.path must be non-empty and absolute');
    }

    return file;
}

function Bundle(files, options) {
    this._options = clone(options || {}, true, 1);

    // browserify-compatible source transforms
    this._transforms = [];

    // filenames executed when the bundle is loaded
    this._entries = new Set();

    // all files included in the bundle
    this._files = new Map();
    this.add(files);

    // external bundles whose modules will be excluded from our own
    this._externals = [];

    // custom dependency names
    this._exposed = new Map();

    // paths -> promises to vinyls being read into buffers
    this._buffering = new Map();

    // controls whether bpack prelude includes require= prefix
    this._hasExports = false;
}

Bundle.prototype._require = function (files) {
    files.forEach(function (file) {this._files.set(file.path, file)}, this);
    return this;
};

Bundle.prototype.require = function (files) {
    return this._require(getVinyls(files));
};

Bundle.prototype.add = function (files) {
    files = getVinyls(files);
    files.forEach(function (file) {this._entries.add(file.path)}, this);
    return this._require(files);
};

Bundle.prototype.expose = function (file, id) {
    file = getVinyl(file);
    this._exposed.set(id, file.path);
    return this._require([file]);
};

Bundle.prototype.external = function (bundle) {
    this._externals.push(bundle);
    bundle._hasExports = true;
    return this;
};

Bundle.prototype.transform = function () {
    this._transforms.push(sliced(arguments));
    return this;
};

Bundle.prototype.bundle = function (callback) {
    var self = this;
    var pack = bpack({raw: true, hasExports: this._hasExports});

    this._readFiles().then(
        function () {
            var sorted = [];

            for (var filename of self._files.keys()) {
                sorted.push(filename);
            }

            sorted.sort().forEach(function (filename) {
                var file = self._files.get(filename);

                pack.write({
                    id: file._hash,
                    deps: file._deps,
                    sourceFile: file.path,
                    source: file.contents,
                    entry: self._entries.has(filename),
                    nomap: !self._options.debug
                });
            });

            pack.end();
        },
        function (error) {
            pack.emit('error', error);

            if (callback) {
                callback(error, null);
            }
        }
    );

    if (callback) {
        return pack.pipe(concat(function (buf) {callback(null, buf)}));
    }

    return pack;
};

Bundle.prototype._readFiles = function () {
    var promises = [];
    for (var file of this._files.values()) {
        promises.push(this._readFile(file));
    }

    return Q.all(promises);
};

Bundle.prototype._readFile = function (file) {
    var promise = this._buffering.get(file.path);
    if (promise) {
        return promise;
    }

    var self = this;
    var deferred = Q.defer();

    var bufferThenResolve = function () {
        file._buffer(self._transforms).then(
            function () {
                self._resolveRequires(file).then(readFinished, deferred.reject);
            },
            deferred.reject
        );
    };

    var readFinished = function () {
        deferred.resolve(file);
        self._buffering.delete(file.path);
    };

    if (file.isBuffer()) {
        bufferThenResolve();
        return deferred.promise;
    }

    Q.nfcall(fs.stat, file.path).then(
        function (stats) {
            var oldStats = file.stats;
            file.stats = stats;

            if (!oldStats || oldStats.mtime < stats.mtime) {
                file._transforms = false;

                bufferThenResolve();
            } else {
                // mtime hasn't changed, return cached buffer
                readFinished();
            }
        },
        function (err) {
            // allow files to not exist on disk if a buffer/stream is provided
            if (err.code !== 'ENOENT' || file.isNull()) {
                deferred.reject(err);
            } else {
                bufferThenResolve();
            }
        }
    );

    this._buffering.set(file.path, deferred.promise);
    return deferred.promise;
};

Bundle.prototype._resolveRequires = function (file) {
    file._deps = {};

    var promises = [];
    for (var id of (new Set(detective(file.contents)))) {
        promises.push(this._resolveRequire(file, id));
    }

    return Q.all(promises);
};

Bundle.prototype._resolveRequire = function (file, id) {
    var self = this;
    var deferred = Q.defer();

    function resolved(depFile) {
        file._deps[id] = depFile._hash;
        deferred.resolve();
    }

    // check if the id is exposed by an external bundle
    this._findExternal(function (b) {
        var filename = b._exposed.get(id);
        if (filename) {
            return b._files.get(filename);
        }
    }).then(
        resolved,
        function () {
            bresolve(id, {filename: file.path}, function (error, depFilename) {
                if (error) {
                    deferred.reject(error);
                    return;
                }

                // check if the file exists in an external bundle
                self._findExternal(function (b) {
                    return b._files.get(depFilename);
                }).then(
                    resolved,
                    function () {
                        // id is not a path; make sure we expose the actual resolved path,
                        // so dependent bundles can require the same identifer from us.
                        if (!/^(\.\/|\/|\.\.\/)/.test(id) && !self._exposed.has(id)) {
                            self._exposed.set(id, depFilename);
                        }

                        // wasn't found in any external bundle, add it to ours
                        self.require(depFilename);
                        self._readFile(self._files.get(depFilename)).then(resolved, deferred.reject);
                    }
                );
            });
        }
    );

    return deferred.promise;
};

Bundle.prototype._findExternal = function (callback) {
    var externals = this._externals;
    var deferred = Q.defer();

    if (externals && externals.length) {
        Q.any(externals.map(function (b) {
            var deferredMatch = Q.defer();

            b._readFiles().then(
                function () {
                    var file = callback(b);
                    if (file) {
                        deferredMatch.resolve(file);
                    } else {
                        deferredMatch.reject();
                    }
                },
                function (error) {
                    throw error;
                }
            );

            return deferredMatch.promise;
        })).then(deferred.resolve, deferred.reject);
    } else {
        deferred.reject();
    }

    return deferred.promise;
};

module.exports = function (options) {
    return new Bundle(options);
};
