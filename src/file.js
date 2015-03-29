'use strict';

var assign = require('object-assign');
var crypto = require('crypto');
var path = require('path');
var VinylFile = require('vinyl');

function File() {
    VinylFile.apply(this, arguments);
    addProps(this);
}

File.prototype = Object.create(VinylFile.prototype);

function addProps(file) {
    return assign(file, {
        // data piped to browser-pack
        _hash: sha1(file.path),
        _deps: {},
        // whether transforms were run
        _transformed: false
    });
}

function sha1(str) {
    return crypto.createHash('sha1').update(str).digest('hex').substring(0, 7);
}

module.exports = function (file) {
    if (typeof file === 'string') {
        return new File({path: path.resolve(file)});
    }

    if (!file.path || !/^\//.test(file.path)) {
        throw new Error('file.path must be non-empty and absolute');
    }

    return addProps(file);
};
