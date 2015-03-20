var arrayUniq = require('array-uniq');
var bpack = require('browser-pack');
var bresolve = require('browser-resolve');
var clone = require('clone');
var crypto = require('crypto');
var detective = require('detective');
var flatten = require('flatten');
var fs = require('fs');
var glob = require('glob');
var minimatch = require('minimatch');
var path = require('path');
var Q = require('q');

function Bundle(options) {
    this._options = clone(options, true, 1);
    this._pack = null;
    this._resolving = null;

    // Caches globbed file names
    this._filenameCache = [];

    // Caches transformed modules
    this._moduleCache = new Map();

    // Maps absolute paths to promises that resolve to module objects
    this._mapping = new Map();
}

Bundle.prototype.write = function (filename) {
    this._begin();
    return this._pack;
};

function promiseGlob(pattern) {
    return Q.nfcall(glob, pattern);
}

Bundle.prototype._getModulesForCachedFiles = function () {
    return Q.all(this._filenameCache.map(this._getModule, this));
};

Bundle.prototype._begin = function () {
    var self = this;

    if (this._resolving) {
        if (this._resolving.isFulfilled()) {
            return this_getModulesForCachedFiles();
        }
        return this._resolving;
    }

    var options = this._options;
    var deferred = Q.defer();

    function onError(error) {
        deferred.reject(error);
    }

    // Resolve globs to an aggregated list of all absolute paths to be included in the bundle.
    Q.all((options.externals || []).map(function (b) {return b._begin()}))
        .then(function () {
            return Q.all(flatten([options.entries || [], options.requires || []]).map(promiseGlob));
        }, onError)
        .then(function (globResults) {
            var absPaths = flatten(globResults).map(function (p) {
                return path.resolve(p);
            });

            self._filenameCache = arrayUniq(absPaths);

            return self._getModulesForCachedFiles();
        }, onError)
        .then(function () {deferred.resolve()}, onError);

    this._pack = bpack({raw: true});

    function done() {
        self._pack.end();
        self._pack = null;
    }

    this._resolving = deferred.promise;
    this._resolving.then(done, done);
    return this._resolving;
};

Bundle.prototype._getModule = function (filename) {
    // Check if we're already processing this module
    if (this._mapping.has(filename)) {
        return this._mapping.get(filename);
    }

    // Check if the module exists in an external bundle
    var externalPromise = this._getExternalModule(filename);
    if (externalPromise) {
        return externalPromise;
    }

    // Indicates when the module and all of its dependencies are processed
    var deferred = Q.defer();
    var self = this;
    var options = this._options;
    var module;

    function onError(error) {
        deferred.reject(error);
    }

    function finish() {
        self._pack.write(module);
        deferred.resolve(module);
    }

    if (this._moduleCache.has(filename)) {
        module = this._moduleCache.get(filename);
    } else {
        module = {
            deps: {},
            sourceFile: filename,
            entry: (options.entries || []).some(function (e) {return minimatch(filename, e)})
        };
        this._moduleCache.set(filename, module);
    }

    Q.nfcall(fs.stat, filename)
        .then(function (stats) {
            if (stats.isFile()) {
                if (!module.mtime || module.mtime < stats.mtime) {
                    module.mtime = stats.mtime;
                    return Q.nfcall(fs.readFile, filename);
                } else {
                    finish();
                }
            }
        }, onError)
        .then(function (source) {
            module.id = moduleHash(filename, source);
            module.source = source.toString();

            if (options.transforms) {
                options.transforms.forEach(function (transform) {
                    module.source = transform(filename, module.source);
                });
            }

            var requires = detective(source);

            var allResolved = Q.all(requires.map(function (id) {
                var mappingDeferred = Q.defer();

                function depResolved(dep) {
                    module.deps[id] = dep.id;
                    mappingDeferred.resolve();
                }

                bresolve(id, {filename: filename}, function (error, depFilename) {
                    if (error) {
                        mappingDeferred.reject();
                        throw error;
                    }

                    // Check if the dependency exists in an external bundle
                    var externalPromise = self._getExternalModule(depFilename);
                    if (externalPromise) {
                        externalPromise.done(depResolved);
                    } else {
                        self._getModule(depFilename).done(depResolved);
                    }
                });

                return mappingDeferred.promise;
            }));

            allResolved.done(finish);
        }, onError);

    this._mapping.set(filename, deferred.promise);
    return deferred.promise;
};

Bundle.prototype._getExternalModule = function (filename) {
    var promise;

    if (this._options.externals) {
        this._options.externals.every(function (b) {
            if (b._mapping.has(filename)) {
                promise = b._mapping.get(filename);
                return false; // break
            }
            return true; // continue
        });
    }

    return promise;
};

function moduleHash(filename, source) {
    var sha1 = crypto.createHash('sha1');
    sha1.update(JSON.stringify([filename, source]));
    return sha1.digest('hex').substring(0, 7);
}

module.exports = function (options) {
    return new Bundle(options);
};
