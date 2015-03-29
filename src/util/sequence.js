'use strict';

var noError = require('./noError');

module.exports = function sequence(items, forEach, cb) {
    items = [].concat(items);

    var count = items.length;
    var position = 0;

    function done(err) {
        items = null;
        cb(err);
    }

    function tick() {
        if (position === count) {
            done(null);
        } else {
            forEach(items[position], noError(done, next));
            items[position] = null;
            ++position;
        }
    }

    function next() {
        process.nextTick(tick);
    }

    next();
};
