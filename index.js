'use strict';

var bpack = require('browser-pack');
var bresolve = require('browser-resolve');
var clone = require('clone');
var concat = require('concat-stream');
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

// property on module objects that stores deps in the current bundle only,
// i.e. excluding external deps -- used when piping things to bpack
var BUNDLED_DEPS = Symbol();

// property on module objects linking to promises for resolving dep ids
var RESOLVING_REQUIRES = Symbol();

// mtime prop for module source
var LAST_MODIFIED = Symbol();

// global module cache, minus bundle-specific props (entry, nomap)
var MODULE_CACHE = new Map();

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

function definedHiddenProp(object, key, value) {
    Object.defineProperty(object, key, {
        value: value,
        configurable: false,
        enumerable: false,
        writable: true
    });
}

function Bundle(files, options) {
    this._options = clone(options || {}, true, 1);

    // browserify-compatible source transforms
    this._transforms = [];

    // files the execute when the bundle is loaded
    this._entries = flatten([].concat(files).map(function (pattern) {
        return glob.sync(pattern).map(function (p) {return path.resolve(p)});
    }));

    // other exports included in the bundle
    this._requires = [];

    // external bundles whose modules will be excluded from our own
    this._externals = [];

    // custom dependency names
    this._exposed = new Map();

    // caches the filename -> module mapping
    this._bundledFileMapping = null;

    // holds a promise to _bundledFileMapping
    this._deferredFileMapping = null;

    // caches pending module promises
    this._loadingFiles = new Map();

    // controls whether bpack prelude includes require= prefix
    this._hasExports = false;
}

Bundle.prototype.transform = function () {
    this._transforms.push(sliced(arguments));
    return this;
};

Bundle.prototype.require = function (file, options) {
    file = path.resolve(file);

    this._requires.push(file);

    if (options && options.expose) {
        this._exposed.set(options.expose, file);
    }

    return this;
};

Bundle.prototype.external = function (bundle) {
    this._externals.push(bundle);
    bundle._hasExports = true;
    return this;
};

Bundle.prototype.bundle = function (callback) {
    var pack = bpack({raw: true, hasExports: this._hasExports});

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
                pack.write(
                    Object.create(mapping.get(filename), {
                        entry: self._entries.some(function (e) {return minimatch(filename, e)}),
                        nomap: !self._options.debug
                    })
                );
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

    Q.all(this._entries.concat(this._requires).map(this._add, this)).then(
        function (modules) {
            addModules(modules);
            self._bundledFileMapping = mapping;
            success(mapping);
            deferred.resolve(mapping);
        },
        function (error) {
            failure(error);
            deferred.reject(error);
        }
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
                var module = self._findOrCreateModule(filename);

                if (!module[LAST_MODIFIED] || module[LAST_MODIFIED] < stats.mtime) {
                    module[LAST_MODIFIED] = stats.mtime;

                    var loading = self._loadModule(module);

                    loading.then(
                        function () {deferred.resolve(module)},
                        deferred.reject
                    );

                    loading.finally(function () {
                        self._loadingFiles.delete(filename);
                    });
                } else {
                    // mtime hasn't changed, return cached entry
                    deferred.resolve(module);
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

    // clear previous load results
    module.deps = {};
    module[BUNDLED_DEPS] = [];

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
    var resolving = module[RESOLVING_REQUIRES];

    if (resolving.has(id)) {
        return resolving.get(id);
    }

    var self = this;
    var deferred = Q.defer();
    resolving.set(id, deferred.promise);

    var resolved = function (dep) {
        module.deps[id] = dep.id;
        deferred.resolve();
    };

    deferred.promise.finally(function () {
        resolving.delete(id);
    });

    // check if the id is exposed by an external bundle
    this._findExternal(function (b, mapping) {
        var filename = b._exposed.get(id);
        if (filename) {
            return mapping.get(filename);
        }
    }).then(
        resolved,
        function () {
            bresolve(id, {filename: module.sourceFile}, function (error, depFilename) {
                if (error) {
                    deferred.reject(error);
                    return;
                }

                // check if the file exists in an external bundle
                self._findExternal(function (b, mapping) {
                    return mapping.get(depFilename);
                }).then(
                    resolved,
                    function () {
                        // id is not a path; make sure we expose the actual resolved path,
                        // so dependent bundles can require the same identifer from us.
                        if (!/^(\.\/|\/|\.\.\/)/.test(id) && !self._exposed.has(id)) {
                            self._exposed.set(id, depFilename);
                        }

                        // wasn't found in any external bundle, add it to ours
                        self._add(depFilename).done(function (dep) {
                            module[BUNDLED_DEPS].push(dep);
                            resolved(dep);
                        });
                    }
                );
            });
        }
    );

    return deferred.promise;
};

Bundle.prototype._findExternal = function (callback) {
    var self = this;
    var externals = this._externals;
    var deferred = Q.defer();

    if (externals && externals.length) {
        Q.any(externals.map(function (b) {
            var deferredMatch = Q.defer();

            b._getBundledModules(
                function (mapping) {
                    var module = callback(b, mapping);
                    if (module) {
                        deferredMatch.resolve(module);
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

Bundle.prototype._findOrCreateModule = function (filename) {
    var module = MODULE_CACHE.get(filename);
    if (module) {
        return module;
    }

    module = {deps: {}, sourceFile: filename};
    definedHiddenProp(module, BUNDLED_DEPS, []);
    definedHiddenProp(module, RESOLVING_REQUIRES, new Map());
    definedHiddenProp(module, LAST_MODIFIED, undefined);

    MODULE_CACHE.set(filename, module);
    return module;
};

module.exports = function (options) {
    return new Bundle(options);
};
