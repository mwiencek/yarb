'use strict';

var bresolve = require('browser-resolve');
var detective = require('detective');
var Promise = require('promise');
var bufferFile = require('./buffer-file.js');

function resolveBundleRequires(bundle) {
    // our externals' requires must be resolved first
    return Promise.all(bundle._externals.map(resolveBundleRequires)).then(function () {
        var promises = [];
        for (var sourceFile of bundle._files.values()) {
            promises.push(resolveFileRequires(bundle, sourceFile));
        }
        return Promise.all(promises);
    });
}

function resolveFileRequires(bundle, file) {
    return bufferFile(bundle, file).then(function () {
        var promises = [];
        for (var id of (new Set(detective(file.contents)))) {
            promises.push(resolveRequire(bundle, file, id));
        }
        return Promise.all(promises);
    });
}

function resolveRequire(bundle, sourceFile, id) {
    function resolved(depFile) {
        sourceFile._deps[id] = depFile._hash;
        return Promise.resolve();
    }

    // check if id is exposed by the current bundle or an external bundle
    var file = getExposedFile(bundle, id) || findExternalFile(bundle._externals, function (externalBundle) {
        return getExposedFile(externalBundle, id);
    });

    if (file) {
        return resolved(file);
    }

    return Promise.denodeify(bresolve)(id, {filename: sourceFile.path}).then(function (depFilename) {
        // check if the file exists in an external bundle
        var file = findExternalFile(bundle._externals, function (externalBundle) {
            return externalBundle._files.get(depFilename);
        });

        if (file) {
            return resolved(file);
        }

        // id is not a path; make sure we expose the actual resolved path,
        // so dependent bundles can require the same identifer from us.
        if (!/^(\.\/|\/|\.\.\/)/.test(id) && !bundle._exposed.has(id)) {
            bundle._exposed.set(id, depFilename);
        }

        // wasn't found in any external bundle, add it to ours
        bundle.require(depFilename);

        var depFile = bundle._files.get(depFilename);
        return resolveFileRequires(bundle, depFile).then(function () {return resolved(depFile)});
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

module.exports = resolveBundleRequires;
