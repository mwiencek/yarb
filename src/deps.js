'use strict';

var detective = require('detective');
var path = require('path');
var bufferFile = require('./buffer-file.js');
var looksLikePath = require('./looks-like-path.js');
var noError = require('./util/noError');
var sequence = require('./util/sequence');

function resolveBundleDeps(bundle, resolver, cb) {
    if (bundle._resolvingDeps) {
        bundle.once('resolve', cb);
        return;
    }

    bundle._resolvingDeps = true;
    var finish = function (err) {
        cb(err);
        bundle._resolvingDeps = false;
        bundle.emit('resolve', err);
    };

    // our externals' requires must be resolved first
    var forEachBundle = function (externalBundle, cb) {
        resolveBundleDeps(externalBundle, resolver, cb);
    };

    sequence(bundle._externals, forEachBundle, noError(finish, function () {
        function forEachFile(file, cb) {
            resolveFileDeps(bundle, file, resolver, cb);
        }
        sequence(bundle._files.values(), forEachFile, finish);
    }));
}

function resolveFileDeps(bundle, file, resolver, cb) {
    bufferFile(bundle, file, noError(cb, function (buf) {
        var requires = new Set(detective(buf));

        function forEachId(id, cb) {
            resolveRequire(bundle, file, id, resolver, cb);
        }

        sequence(requires, forEachId, cb);
    }));
}

function resolveRequire(bundle, sourceFile, id, resolver, cb) {
    function addDep(depFile) {
        sourceFile._deps[id] = depFile._hash;
        cb(null);
    }

    // check if id is exposed by the current bundle or an external bundle
    var file = getExposedFile(bundle, id) || findExternalFile(bundle._externals, function (externalBundle) {
        return getExposedFile(externalBundle, id);
    });

    if (file) {
        addDep(file);
        return;
    }

    resolver.resolve(id, sourceFile.path, function (err, depFilename) {
        if (err) {
            if (looksLikePath(id)) {
                depFilename = path.resolve(path.dirname(sourceFile.path), id);
            } else {
                cb(err);
                return;
            }
        }

        // check if the file exists in an external bundle
        var file = findExternalFile(bundle._externals, function (externalBundle) {
            return externalBundle._files.get(depFilename);
        });

        if (file) {
            addDep(file);
            return;
        }

        // id is not a path; make sure we expose the actual resolved path,
        // so dependent bundles can require the same identifer from us.
        if (!looksLikePath(id) && !bundle._exposed.has(id)) {
            bundle._exposed.set(id, depFilename);
        }

        // wasn't found in any external bundle, add it to ours
        bundle.require(depFilename);

        var depFile = bundle._files.get(depFilename);

        resolveFileDeps(bundle, depFile, resolver, noError(cb, function () {
            addDep(depFile);
        }));
    });
}

function findExternalFile(externals, callback) {
    for (var i = 0, len = externals.length; i < len; i++) {
        var file = callback(externals[i]);
        if (file) {
            return file;
        }
    }
}

function getExposedFile(bundle, id) {
    var filename = bundle._exposed.get(id);
    if (filename) {
        return bundle._files.get(filename);
    }
}

module.exports = resolveBundleDeps;
