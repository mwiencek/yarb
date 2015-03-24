'use strict';

var bpack = require('browser-pack');
var clone = require('clone');
var concat = require('concat-stream');
var Q = require('q');
var sliced = require('sliced');
var getVinyl = require('./src/file.js');
var resolveRequires = require('./src/resolve-requires.js');

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
    files.forEach(function (file) {
        if (!this._files.has(file.path)) {
            this._files.set(file.path, file);
        }
    }, this);
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

    resolveRequires(this).then(
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

function getVinyls(files) {
    return [].concat(files).map(getVinyl);
}

module.exports = function (options) {
    return new Bundle(options);
};
