'use strict';

var bresolve = require('browser-resolve');
var detective = require('detective');
var Q = require('q');

function resolveRequires(bundle, sourceFile) {
    sourceFile._deps = {};

    var promises = [];
    for (var id of (new Set(detective(sourceFile.contents)))) {
        promises.push(resolveRequire(bundle, sourceFile, id));
    }

    return Q.all(promises);
}

function resolveRequire(bundle, sourceFile, id) {
    var deferred = Q.defer();

    function resolved(depFile) {
        sourceFile._deps[id] = depFile._hash;
        deferred.resolve();
    }

    // check if the id is exposed by an external bundle
    findExternalFile(bundle, function (externalBundle) {
        var filename = externalBundle._exposed.get(id);
        if (filename) {
            return externalBundle._files.get(filename);
        }
    }).then(
        resolved,
        function () {
            bresolve(id, {filename: sourceFile.path}, function (error, depFilename) {
                if (error) {
                    deferred.reject(error);
                    return;
                }

                // check if the file exists in an external bundle
                findExternalFile(bundle, function (externalBundle) {
                    return externalBundle._files.get(depFilename);
                }).then(
                    resolved,
                    function () {
                        // id is not a path; make sure we expose the actual resolved path,
                        // so dependent bundles can require the same identifer from us.
                        if (!/^(\.\/|\/|\.\.\/)/.test(id) && !bundle._exposed.has(id)) {
                            bundle._exposed.set(id, depFilename);
                        }

                        // wasn't found in any external bundle, add it to ours
                        bundle.require(depFilename);
                        bundle._readFile(bundle._files.get(depFilename)).then(resolved, deferred.reject);
                    }
                );
            });
        }
    );

    return deferred.promise;
}

function findExternalFile(bundle, callback) {
    var externals = bundle._externals;
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
}

module.exports = resolveRequires;
