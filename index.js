'use strict';

var bpack = require('browser-pack');
var concat = require('concat-stream');
var events = require('events');
var path = require('path');
var sliced = require('sliced');
var util = require('util');
var first = require('./src/util/first');
var getVinyl = require('./src/file');
var Resolver = require('./src/resolver');
var resolveDeps = require('./src/deps');

function Bundle(files, options) {
    options = options || {};

    this._debug = !!options.debug;
    this._basedir = options.basedir || process.cwd();

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

    // inverse mapping of _exposed. not a real word
    this._inposed = Object.create(null);

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
    return this._require(getVinyls(files, this._basedir));
};

Bundle.prototype._add = function (file) {
    this._entries[file.path] = true;
};

Bundle.prototype.add = function (files) {
    files = getVinyls(files, this._basedir);
    files.forEach(this._add, this);
    return this._require(files);
};

Bundle.prototype.expose = function (file, id) {
    file = getVinyl(file, this._basedir);
    this._exposed[id] = file.path;
    this._inposed[file.path] = id;
    return this._require([file]);
};

Bundle.prototype._externalID = function (file) {
    return getInposed(file, this) || file._hash;
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
                id: self._externalID(file),
                deps: file._deps,
                sourceFile: file.path,
                source: String(file.contents),
                entry: filename in self._entries,
                nomap: !self._debug
            });
        });

        pack.end();
    });

    if (callback) {
        pack.pipe(concat({encoding: 'buffer'}, function (buf) {
            callback(null, buf);
        }));
    }

    return pack;
};

Bundle.prototype.has = function (filename) {
    return path.resolve(this._basedir, filename) in this._files;
};

function getVinyls(files, basedir) {
    return [].concat(files).map(function (file) {
        return getVinyl(file, basedir);
    });
}

function getInposed(file, bundle) {
    return bundle._inposed[file.path] || first(bundle._externals, getInposed.bind(null, file));
}

module.exports = function (files, options) {
    return new Bundle(files, options);
};
