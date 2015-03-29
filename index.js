'use strict';

var bpack = require('browser-pack');
var clone = require('clone');
var events = require('events');
var sliced = require('sliced');
var util = require('util');
var concat = require('./src/util/concat.js');
var getVinyl = require('./src/file.js');
var Resolver = require('./src/resolver.js');
var resolveDeps = require('./src/deps.js');

function Bundle(files, options) {
    this._options = clone(options || {}, true, 1);

    // browserify-compatible source transforms
    this._transforms = [];

    // filenames executed when the bundle is loaded
    this._entries = Object.create(null);

    // all files included in the bundle
    this._files = Object.create(null);

    if (files) {
        this.add(files);
    }

    // external bundles whose modules will be excluded from our own
    this._externals = [];

    // custom dependency names
    this._exposed = Object.create(null);

    // controls whether bpack prelude includes require= prefix
    this._hasExports = false;

    // whether we have a pending resolve action
    this._resolvingDeps = false;
}

util.inherits(Bundle, events.EventEmitter);

Bundle.prototype._require = function (files) {
    files.forEach(function (file) {
        if (!this.has(file.path)) {
            this._files[file.path] = file;
        }
    }, this);
    return this;
};

Bundle.prototype.require = function (files) {
    return this._require(getVinyls(files));
};

Bundle.prototype.add = function (files) {
    files = getVinyls(files);
    files.forEach(function (file) {this._entries[file.path] = true}, this);
    return this._require(files);
};

Bundle.prototype.expose = function (file, id) {
    file = getVinyl(file);
    this._exposed[id] = file.path;
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

    resolveDeps(this, new Resolver(), function (err) {
        if (err) {
            if (callback) {
                callback(err, null);
            }
            pack.emit('error', err);
            return;
        }

        Object.keys(self._files).sort().forEach(function (filename) {
            var file = self._files[filename];

            pack.write({
                id: file._hash,
                deps: file._deps,
                sourceFile: file.path,
                source: file.contents,
                entry: filename in self._entries,
                nomap: !self._options.debug
            });
        });

        pack.end();
    });

    if (callback) {
        concat(pack, callback);
    }

    return pack;
};

Bundle.prototype.has = function (path) {
    return path in this._files;
};

function getVinyls(files) {
    return [].concat(files).map(getVinyl);
}

module.exports = function (options) {
    return new Bundle(options);
};
