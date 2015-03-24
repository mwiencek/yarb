'use strict';

var crypto = require('crypto');
var path = require('path');
var VinylFile = require('vinyl');

function File() {
    VinylFile.apply(this, arguments);

    // data piped to browser-pack
    this._hash = sha1(this.path);
    this._deps = {};

    // whether transforms were run
    this._transformed = false;
}

File.prototype = Object.create(VinylFile.prototype);

function sha1(str) {
    return crypto.createHash('sha1').update(str).digest('hex').substring(0, 7);
}

module.exports = function (file) {
    if (typeof file === 'string') {
        return new File({path: path.resolve(file)});
    }

    if (!file.path || !path.isAbsolute(file.path)) {
        throw new Error('file.path must be non-empty and absolute');
    }

    return file;
};
