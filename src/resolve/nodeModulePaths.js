'use strict';

var path = require('path');

var cache = new Map();

module.exports = function nodeModulePaths(start) {
    start = path.resolve(start);

    if (cache.has(start)) {
        return cache.get(start);
    }

    var parts = start.split(path.sep);
    if (parts[0] === '') {
        parts[0] = path.sep;
    }

    var root = Math.max(parts.indexOf('node_modules'), 0);
    var i = parts.length - 1;
    var dirs = [];

    while (i > root) {
        if (parts[i] !== 'node_modules') {
            dirs.push(path.join.apply(path, parts.slice(0, i + 1).concat('node_modules')));
        }
        --i;
    }

    cache.set(start, dirs);
    return dirs;
};
