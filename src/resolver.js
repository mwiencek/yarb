var fs = require('fs');
var path = require('path');
var either = require('./resolve/either');
var loadAsDirectory = require('./resolve/loadAsDirectory');
var loadAsFile = require('./resolve/loadAsFile');
var looksLikePath = require('./util/looksLikePath');
var nodeModulePaths = require('./resolve/nodeModulePaths');
var noError = require('./util/noError');

// http://nodejs.org/docs/v0.4.8/api/all.html#all_Together...
// does not handle: core modules, binary addons, or "browser" field names

function Resolver() {
    this._resolveCache = Object.create(null);
}

Resolver.prototype._loadAsFileOrDirectory = function (x, bundle, cb) {
    var cache = this._resolveCache;

    if (x in cache) {
        cb(null, cache[x]);
    } else {
        var done = noError(cb, function (file) {
            if (file) {
                cache[x] = file;
            }
            cb(null, file);
        });
        loadAsFile(x, bundle, either(done, loadAsDirectory.bind(null, x, bundle, done)));
    }
};

Resolver.prototype._loadNodeModules = function (x, start, bundle, cb) {
    var self = this;
    var dirs = nodeModulePaths(start);
    var index = 0;

    (function checkNext() {
        if (index === dirs.length) {
            cb(null, null);
        } else {
            self._loadAsFileOrDirectory(path.join(dirs[index++], x), bundle, either(cb, checkNext));
        }
    }());
};

Resolver.prototype.resolve = function (x, sourceFile, bundle, cb) {
    var self = this;
    var dirname = path.dirname(sourceFile);

    function tryNodeModules() {
        self._loadNodeModules(x, dirname, bundle, either(cb, function () {
            cb('module ' + JSON.stringify(x) + ' not found (required from ' + sourceFile + ')', null);
        }));
    }

    if (looksLikePath(x)) {
        this._loadAsFileOrDirectory(path.resolve(dirname, x), bundle, either(cb, tryNodeModules));
    } else {
        tryNodeModules();
    }
};

module.exports = Resolver;
