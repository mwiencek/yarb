require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"a6ede29":[function(require,module,exports){
// lib_plugin provides lib, so the bundle should provide both
require('lib_plugin');

// browser-field name
require('shim');

module.exports = 'bundle1';

},{"lib_plugin":"723ce69","shim":"ad8ec33"}],"723ce69":[function(require,module,exports){
module.exports = require('lib') + '_plugin';

},{"lib":"aad9888"}],"aad9888":[function(require,module,exports){
module.exports = 'lib';

},{}],"ad8ec33":[function(require,module,exports){
module.exports = 'shim';

},{}]},{},["a6ede29"]);
