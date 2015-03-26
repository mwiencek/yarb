'use strict';

var isFile = require('./isFile');
var noError = require('./noError');

module.exports = function loadAsFile(x, cb) {
    isFile(x, noError(cb, function (result) {
        if (result) {
            cb(null, x);
        } else {
            isFile(x + '.js', noError(cb, function (result) {
                if (result) {
                    cb(null, x + '.js');
                } else {
                    cb(null, null);
                }
            }));
        }
    }));
};
