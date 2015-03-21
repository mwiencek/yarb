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
var sliced = require('sliced');
var through2 = require('through2');

var BUNDLED_DEPS = Symbol();
var SOURCE_CACHE = new Map();

function promiseGlob(pattern) {
    return Q.nfcall(glob, pattern);
}

function moduleHash(filename, source) {
    var sha1 = crypto.createHash('sha1');
    sha1.update(JSON.stringify([filename, source]));
    return sha1.digest('hex').substring(0, 7);
}

function setSource(module, source) {
    module.source = source;
    module.id = moduleHash(module.sourceFile, source);
}

function strcmp(a, b) {
    return a.localeCompare(b);
}

function Bundle(options) {
    this._options = clone(options, true, 1);

    // Browserify-compatible source transforms
    this._transforms = [];

    // Caches globbed filenames for entries/requires
    this._globbedFiles = null;

    // Caches the filename -> module mapping
    this._bundledFileMapping = null;

    // Holds a promise to _bundledFileMapping
    this._deferredFileMapping = null;

    // Caches pending module promises
    this._loadingFiles = new Map();
}

Bundle.prototype.transform = function () {
    this._transforms.push(sliced(arguments));
};

Bundle.prototype.bundle = function () {
    var pack = bpack({raw: true});

    // Source code may have changed
    this._bundledFileMapping = null;
    this._deferredFileMapping = null;

    this._getBundledModules(
        function (mapping) {
            var sorted = [];

            for (var filename of mapping.keys()) {
                sorted.push(filename);
            }

            sorted.sort().forEach(function (filename) {
                pack.write(mapping.get(filename));
            });

            pack.end();
        },
        function (error) {
            throw error;
        }
    );

    return pack;
};

Bundle.prototype._getBundledModules = function (success, failure) {
    if (this._bundledFileMapping) {
        success(this._bundledFileMapping);
        return;
    }

    if (this._deferredFileMapping) {
        this._deferredFileMapping.then(success, failure);
        return;
    }

    var self = this;
    var mapping = new Map();
    var deferred = Q.defer();
    this._deferredFileMapping = deferred.promise;

    var addSelfAndDeps = function (m) {
        mapping.set(m.sourceFile, m);
        addModules(m[BUNDLED_DEPS]);
    };

    var addModules = function (modules) {
        modules.forEach(addSelfAndDeps);
    };

    var onError = function (error) {
        failure(error);
        deferred.reject(error);
    };

    var addFiles = function (filenames) {
        Q.all(filenames.map(self._add, self)).then(
            function (modules) {
                addModules(modules);
                self._bundledFileMapping = mapping;
                success(mapping);
                deferred.resolve(mapping);
            },
            onError
        );
    };

    if (this._globbedFiles) {
        addFiles(this._globbedFiles);
        return;
    }

    Q.all(flatten([this._options.entries || [], this._options.requires || []]).map(promiseGlob))
        .then(function (globResults) {
            var filenames = flatten(globResults).map(function (p) {
                return path.resolve(p);
            });

            self._globbedFiles = filenames;
            addFiles(filenames);
        },
        onError
    );
};

Bundle.prototype._add = function (filename) {
    if (this._loadingFiles.has(filename)) {
        return this._loadingFiles.get(filename);
    }

    var self = this;
    var deferred = Q.defer();

    Q.nfcall(fs.stat, filename).then(
        function (stats) {
            if (stats.isFile()) {
                var cached = SOURCE_CACHE.get(filename);
                var module = self._createModule(filename);

                if (!cached || cached.mtime < stats.mtime) {
                    SOURCE_CACHE.set(filename, {mtime: stats.mtime, source: Q.defer()});

                    self._loadModule(module).then(
                        function () {
                            deferred.resolve(module);
                            self._loadingFiles.delete(filename);
                        },
                        function (error) {
                            deferred.reject(error);
                            self._loadingFiles.delete(filename);
                        }
                    );
                } else {
                    // mtime hasn't changed, return cached entry
                    cached.source.promise.done(function (source) {
                        setSource(module, source);
                        deferred.resolve(module);
                    });
                }
            } else {
                deferred.reject();
            }
        },
        deferred.reject
    );

    this._loadingFiles.set(filename, deferred.promise);
    return deferred.promise;
};

Bundle.prototype._loadModule = function (module) {
    var self = this;
    var source = '';
    var deferred = Q.defer();
    var stream = fs.createReadStream(module.sourceFile);

    if (self._transforms) {
        self._transforms.forEach(function (args) {
            var transform = args[0];

            if (typeof transform === 'string') {
                transform = require(transform);
            }

            stream = stream.pipe(
                transform.apply(null, [module.sourceFile].concat(args.slice(1)))
            );
        });
    }

    stream
        .on('error', deferred.reject)
        .on('end', function () {
            setSource(module, source);

            SOURCE_CACHE.get(module.sourceFile).source.resolve(source);

            self._resolveRequires(module).then(
                function () {deferred.resolve(module)},
                deferred.reject
            );
        })
        .pipe(through2(function (chunk, enc, cb) {
            source += chunk.toString();
            cb();
        }));

    return deferred.promise;
};

Bundle.prototype._resolveRequires = function (module) {
    // Recursively resolve all require()'d modules in the source
    var self = this;

    return Q.all(detective(module.source).map(function (id) {
        return self._resolveRequire(module, id);
    }));
};

Bundle.prototype._resolveRequire = function (module, id) {
    var self = this;
    var deferred = Q.defer();

    function resolved(dep) {
        module.deps[id] = dep.id;
        deferred.resolve();
    }

    bresolve(id, {filename: module.sourceFile}, function (error, depFilename) {
        if (error) {
            deferred.reject(error);
            return;
        }

        var addToBundle = function () {
            self._add(depFilename).done(function (dep) {
                module[BUNDLED_DEPS].push(dep);
                resolved(dep);
            });
        };

        // Check if the dependency exists in an external bundle
        var externals = self._options.externals;

        if (externals && externals.length) {
            Q.any(externals.map(function (b) {
                var externalModule = Q.defer();

                b._getBundledModules(
                    function (mapping) {
                        var external = mapping.get(depFilename);
                        if (external) {
                            externalModule.resolve(external);
                        } else {
                            externalModule.reject();
                        }
                    },
                    deferred.reject
                );

                return externalModule.promise;
            })).then(resolved, addToBundle);
        } else {
            addToBundle();
        }
    });

    return deferred.promise;
};

Bundle.prototype._createModule = function (filename) {
    var module = {
        deps: {},
        sourceFile: filename,
        entry: (this._options.entries || []).some(function (e) {
            return minimatch(filename, e);
        })
    };

    Object.defineProperty(module, BUNDLED_DEPS, {
        value: [],
        configurable: false,
        enumerable: false,
        writable: true
    });

    return module;
};

module.exports = function (options) {
    return new Bundle(options);
};
