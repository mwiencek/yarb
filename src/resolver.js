var fs = require('fs');
var path = require('path');
var Promise = require('promise');
var either = require('./resolve/either');
var loadAsDirectory = require('./resolve/loadAsDirectory');
var loadAsFile = require('./resolve/loadAsFile');
var looksLikePath = require('./looks-like-path');
var nodeModulePaths = require('./resolve/nodeModulePaths');
var noError = require('./resolve/noError');

// http://nodejs.org/docs/v0.4.8/api/all.html#all_Together...
// does not handle: core modules, binary addons, or "browser" field names

function Resolver() {
    this._resolveCache = new Map();
}

Resolver.prototype._loadAsFileOrDirectory = function (x, cb) {
    var cache = this._resolveCache;

    if (cache.has(x)) {
        cb(null, cache.get(x));
    } else {
        var done = noError(cb, function (resolved) {
            if (resolved) {
                cache.set(x, resolved);
            }
            cb(null, resolved);
        });
        loadAsFile(x, either(done, loadAsDirectory.bind(null, x, done)));
    }
};

Resolver.prototype._loadNodeModules = function (x, start, cb) {
    var self = this;
    var dirs = nodeModulePaths(start);
    var index = 0;

    (function checkNext() {
        if (index === dirs.length) {
            cb(null, null);
        } else {
            self._loadAsFileOrDirectory(path.join(dirs[index++], x), either(cb, checkNext));
        }
    }());
};

Resolver.prototype.resolve = function (x, sourceFile, cb) {
    var self = this;
    var dirname = path.dirname(sourceFile);

    function tryNodeModules() {
        self._loadNodeModules(x, dirname, either(cb, function () {
            cb('module ' + JSON.stringify(x) + ' not found (required from ' + sourceFile + ')', null);
        }));
    }

    if (looksLikePath(x)) {
        this._loadAsFileOrDirectory(path.resolve(dirname, x), either(cb, tryNodeModules));
    } else {
        tryNodeModules();
    }
};

module.exports = Resolver;
