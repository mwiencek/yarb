require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"e72b39a":[function(require,module,exports){
// lib_plugin provides lib, so the bundle should provide both
require('lib_plugin');

// exposed name
require('shim');

module.exports = 'bundle1';

},{"lib_plugin":"f1d2566","shim":"3018e32"}],"f1d2566":[function(require,module,exports){
module.exports = require('lib') + '_plugin';

},{"lib":"0afef4c"}],"0afef4c":[function(require,module,exports){
module.exports = 'lib';

},{}],"3018e32":[function(require,module,exports){
module.exports = 'shim';

},{}]},{},["e72b39a"]);
