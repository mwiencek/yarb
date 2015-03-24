'use strict';

var bresolve = require('browser-resolve');
var detective = require('detective');
var Q = require('q');
var bufferFile = require('./buffer-file.js');

function resolveBundleRequires(bundle) {
    // our externals' requires must be resolved first
    return Q.all(bundle._externals.map(resolveBundleRequires)).then(function () {
        var promises = [];
        for (var sourceFile of bundle._files.values()) {
            promises.push(resolveFileRequires(bundle, sourceFile));
        }
        return Q.all(promises);
    });
}

function resolveFileRequires(bundle, file) {
    return bufferFile(bundle, file).then(function () {
        var promises = [];
        for (var id of (new Set(detective(file.contents)))) {
            promises.push(resolveRequire(bundle, file, id));
        }
        return Q.all(promises);
    });
}

function resolveRequire(bundle, sourceFile, id) {
    var deferred = Q.defer();

    function resolved(depFile) {
        sourceFile._deps[id] = depFile._hash;
        deferred.resolve();
    }

    // check if the id is exposed by an external bundle
    var file = findExternalFile(bundle._externals, function (externalBundle) {
        var filename = externalBundle._exposed.get(id);
        if (filename) {
            return externalBundle._files.get(filename);
        }
    });

    if (file) {
        resolved(file);
        return deferred.promise;
    }

    bresolve(id, {filename: sourceFile.path}, function (err, depFilename) {
        if (err) {
            deferred.reject(err);
            return;
        }

        // check if the file exists in an external bundle
        var file = findExternalFile(bundle._externals, function (externalBundle) {
            return externalBundle._files.get(depFilename);
        });

        if (file) {
            resolved(file);
            return;
        }

        // id is not a path; make sure we expose the actual resolved path,
        // so dependent bundles can require the same identifer from us.
        if (!/^(\.\/|\/|\.\.\/)/.test(id) && !bundle._exposed.has(id)) {
            bundle._exposed.set(id, depFilename);
        }

        // wasn't found in any external bundle, add it to ours
        bundle.require(depFilename);

        var depFile = bundle._files.get(depFilename);

        resolveFileRequires(bundle, depFile).then(
            function () {resolved(depFile)},
            deferred.reject
        );
    });

    return deferred.promise;
}

function findExternalFile(externals, callback) {
    for (var i = 0, len = externals.length; i < len; i++) {
        var file = callback(externals[i]);
        if (file) {
            return file;
        }
    }
}

module.exports = resolveBundleRequires;
