'use strict';

var regexp = /^(\.\/|\/|\.\.\/)/;

module.exports = function looksLikePath(str) {
    return regexp.test(str);
};
