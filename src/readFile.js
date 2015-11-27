'use strict';

var assign = require('object-assign');
var concat = require('concat-stream');
var fs = require('fs');
var path = require('path');

function readFile(bundle, file, cb) {
    fs.stat(file.path, function (err, stats) {
        if (err) {
            if (err.code !== 'ENOENT' || file.isNull()) {
                // only allow files to not exist on disk if a buffer/stream is provided
                cb(err, null);
            } else if (file._transformed) {
                cb(null, file.contents);
            } else {
                transformContents(bundle, file, cb);
            }
        } else if (!file.stats || file.stats.mtime < stats.mtime) {
            // always assume the contents have changed
            assign(file, {contents: null, stats: stats, _deps: {}, _transformed: false});
            transformContents(bundle, file, cb);
        } else {
            // mtime hasn't changed, return cached buffer
            cb(null, file.contents);
        }
    });
}

var insertGlobalsVars = {
    Buffer: function () {
        return "require('buffer').Buffer";
    },
    // default insertion reveals full path
    process: function () {
        return "require('_process')";
    }
};

function transformContents(bundle, file, cb) {
    var pipeline, contents;

    var isExternal = Object.keys(bundle._entries).some(function (entry) {
        return path.relative(path.dirname(entry), file.path).split(path.sep).indexOf('node_modules') >= 0;
    });

    if (file.isNull()) {
        file.contents = fs.createReadStream(file.path);
    }

    var transforms = bundle._transforms.concat([[
        // https://github.com/substack/insert-module-globals
        'insert-module-globals', {
            debug: bundle._debug,
            global: true,
            basedir: bundle._basedir,
            vars: insertGlobalsVars
        }
    ]]);

    transforms.forEach(function (args) {
        var func = args[0];
        var options = args[1];

        if (!isExternal || (options && options.global)) {
            if (typeof func === 'string') {
                func = require(func);
            }

            // https://github.com/substack/node-browserify#btransformtr-opts
            var ws = func.apply(null, [file.path].concat(args.slice(1))).on('error', cb);

            if (!pipeline) {
                pipeline = ws;
                contents = ws;
            } else {
                contents = contents.pipe(ws);
            }
        }
    });

    contents.pipe(concat({encoding: 'buffer'}, function (buf) {
        // transform required JSON into valid JS
        var string = buf.toString();
        var isJSON = true;

        try {
            JSON.parse(string);
        } catch (err) {
            isJSON = false;
        }

        if (isJSON) {
            buf = new Buffer('module.exports = ' + string);
        }

        assign(file, {contents: buf, _transformed: true});
        cb(null, buf);
    }));

    file.pipe(pipeline);
}

module.exports = readFile;
