'use strict';

module.exports = function either(cb, next) {
    return function (err, result) {
        if (err) {
            cb(err, null);
        } else if (result) {
            cb(null, result);
        } else {
            next();
        }
    };
};
