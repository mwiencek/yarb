'use strict';

module.exports = function first(items, callback) {
    for (var i = 0; i < items.length; i++) {
        var result = callback(items[i]);
        if (result) {
            return result;
        }
    }
};
