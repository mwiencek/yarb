'use strict';

module.exports = function first(items, callback) {
    for (var i = 0, len = items.length; i < len; i++) {
        var result = callback(items[i]);
        if (result) {
            return result;
        }
    }
};
