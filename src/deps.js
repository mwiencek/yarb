'use strict';

var arrayUniq = require('array-uniq');
var detective = require('detective');
var path = require('path');
var first = require('./util/first');
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
            resolveFileDeps(bundle._files[filename], bundle, resolver, cb);
        }
        sequence(Object.keys(bundle._files), forEachFile, finish);
    }));
}

function resolveFileDeps(file, bundle, resolver, cb) {
    readFile(bundle, file, noError(cb, function (buf) {
        function forEachId(id, cb) {
            resolveRequire(id, file, bundle, resolver, cb);
        }
        sequence(arrayUniq(detective(buf)), forEachId, cb);
    }));
}

function resolveRequire(id, sourceFile, bundle, resolver, cb) {
    function addDep(depFile) {
        sourceFile._deps[id] = depFile._hash;
        cb(null);
    }

    // check if id is exposed by the current bundle or an external bundle
    var file = getExposedFile(bundle, id) || first(bundle._externals, function (externalBundle) {
        return getExposedFile(externalBundle, id);
    });

    if (file) {
        process.nextTick(function () {
            addDep(file);
        });
        return;
    }

    resolver.resolve(id, sourceFile.path, bundle, noError(cb, function (depFile) {
        // id is not a path; make sure we expose the actual resolved path,
        // so dependent bundles can require the same identifer from us.
        if (!looksLikePath(id) && !(id in bundle._exposed)) {
            bundle._exposed[id] = depFile.path;
        }

        if (depFile.isNull()) {
            // a null file can only mean it's not in any of our externals, so add it to our own
            bundle.require(depFile);
            resolveFileDeps(depFile, bundle, resolver, noError(cb, addDep.bind(null, depFile)));
        } else {
            addDep(depFile);
        }
    }));
}

function getExposedFile(bundle, id) {
    var filename = bundle._exposed[id];
    if (filename) {
        return bundle._files[filename];
    }
}

module.exports = resolveBundleDeps;
