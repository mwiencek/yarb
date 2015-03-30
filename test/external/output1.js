require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"a89c396":[function(require,module,exports){
// lib_plugin provides lib, so the bundle should provide both
require('lib_plugin');

// exposed name
require('shim');

module.exports = 'bundle1';

},{"lib_plugin":"7306050","shim":"02c2834"}],"7306050":[function(require,module,exports){
module.exports = require('lib') + '_plugin';

},{"lib":"d55f59c"}],"d55f59c":[function(require,module,exports){
module.exports = 'lib';

},{}],"02c2834":[function(require,module,exports){
module.exports = 'shim';

},{}]},{},["a89c396"]);
