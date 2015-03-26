'use strict';

var bresolve = require('browser-resolve');
var detective = require('detective');
var path = require('path');
var Promise = require('promise');
var bufferFile = require('./buffer-file.js');

function resolveBundleRequires(bundle) {
    // our externals' requires must be resolved first
    var promise = Promise.resolve();

    bundle._externals.forEach(function (externalBundle) {
        promise = promise.then(resolveBundleRequires.bind(null, externalBundle));
    });

    for (var sourceFile of bundle._files.values()) {
        promise = promise.then(resolveFileRequires.bind(null, bundle, sourceFile));
    }

    return promise;
}

function resolveFileRequires(bundle, file) {
    return bufferFile(bundle, file).then(function () {
        var promise = Promise.resolve();

        for (var id of (new Set(detective(file.contents)))) {
            promise = promise.then(resolveRequire.bind(null, bundle, file, id));
        }

        return promise;
    });
}

function resolveRequire(bundle, sourceFile, id) {
    return new Promise(function (resolve, reject) {
        function addDep(depFile) {
            sourceFile._deps[id] = depFile._hash;
            resolve();
        }

        // check if id is exposed by the current bundle or an external bundle
        var file = getExposedFile(bundle, id) || findExternalFile(bundle._externals, function (externalBundle) {
            return getExposedFile(externalBundle, id);
        });

        if (file) {
            addDep(file);
            return;
        }

        bresolve(id, {filename: sourceFile.path}, function (err, depFilename) {
            if (err) {
                if (looksLikePath(id)) {
                    depFilename = path.resolve(path.dirname(sourceFile.path), id);
                } else {
                    reject(err);
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
            resolveFileRequires(bundle, depFile).then(addDep.bind(null, depFile), reject);
        });
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

function looksLikePath(str) {
    return /^(\.\/|\/|\.\.\/)/.test(str);
}

module.exports = resolveBundleRequires;
