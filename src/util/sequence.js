'use strict';

var noError = require('./noError');

module.exports = function sequence(iterable, forEach, cb) {
    var items = [];

    for (var item of iterable) {
        items.push(item);
    }

    item = null;
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
