'use strict';

module.exports = function noError(cb, otherwise) {
    return function (err, result) {
        if (err) {
            cb(err, null);
        } else {
            otherwise(result);
        }
    };
};
