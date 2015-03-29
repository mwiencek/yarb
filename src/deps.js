'use strict';

var arrayUniq = require('array-uniq');
var detective = require('detective');
var path = require('path');
var looksLikePath = require('./util/looksLikePath');
var noError = require('./util/noError');
var readFile = require('./readFile');
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
        function forEachFile(filename, cb) {
            resolveFileDeps(bundle, bundle._files[filename], resolver, cb);
        }
        sequence(Object.keys(bundle._files), forEachFile, finish);
    }));
}

function resolveFileDeps(bundle, file, resolver, cb) {
    readFile(bundle, file, noError(cb, function (buf) {
        var requires = arrayUniq(detective(buf));

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
        var file = bundle._files[depFilename] || findExternalFile(bundle._externals, function (externalBundle) {
            return externalBundle._files[depFilename];
        });

        if (file) {
            addDep(file);
            return;
        }

        // id is not a path; make sure we expose the actual resolved path,
        // so dependent bundles can require the same identifer from us.
        if (!looksLikePath(id) && !(id in bundle._exposed)) {
            bundle._exposed[id] = depFilename;
        }

        // wasn't found in our own bundle or any external one, add it to ours
        bundle.require(depFilename);

        file = bundle._files[depFilename];

        resolveFileDeps(bundle, file, resolver, noError(cb, addDep.bind(null, file)));
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
    var filename = bundle._exposed[id];
    if (filename) {
        return bundle._files[filename];
    }
}

module.exports = resolveBundleDeps;
