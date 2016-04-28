# yarb

[![Build Status](https://travis-ci.org/mwiencek/yarb.svg?branch=master)](https://travis-ci.org/mwiencek/yarb)

yarb performs mostly the same task as [browserify](https://github.com/substack/node-browserify), and shares a lot of the same internals ([browser-pack](https://github.com/substack/browser-pack), [node-detective](https://github.com/substack/node-detective), [insert-module-globals](https://github.com/substack/insert-module-globals)).

yarb is much less flexible than browserify, but better at defining dependencies between bundles. In browserify, sharing files between bundles tends to require a lot of manual `expose` and `external` settings on each file. A yarbundle’s `external` function only accepts other bundles as input, and the bundling process knows exactly which files are common to both.

While yarb shares API similarities with browserify and is even compatible with browserify transforms, it currently does not handle the full array of core modules (only `events`, `fs`, `module`, `net`, `path`, `stream`, `util`), and lacks most of the settings and behaviors that browserify has.

This project served two purposes for me: (1) fixing a frustration after failing to patch browserify to suit my needs, and (2) learning better how to write node modules. Use browserify unless you know what you’re doing.

## Notes

Internally, yarb stores files as [vinyl](https://github.com/wearefractal/vinyl) objects, and even accepts these as input wherever a path is accepted. This allows passing in existing buffers/streams by just wrapping them in vinyl objects beforehand.

The catch is that all vinyls must have a `path` property that is both unique to the bundle and absolute (though it doesn't have to exist on disk). Paths are how modules reference each other, after all.

The `expose` method could theoretically support exposing a vinyl buffer/stream as an arbitrary ID, since those always take precedence over paths. That’d be a rare case, since the vast majority of things will be sourced from disk. Giving a fake but unique path where one doesn't exist will otherwise suffice.

## API

### var bundle = yarb([files[, options]])

Returns a new bundle with `files` as entry points, i.e. modules executed when the bundle is loaded. `files` can be a single file or an array of files consisting of paths or vinyl objects.

Current `options` are:

Option    | Purpose
--------- | -------------
`debug`   | Enables source maps.
`basedir` | Sets the starting point for resolving relative paths.

### bundle.add(files)

Adds additional entry files to `bundle`. See above for accepted inputs for `files`.

Returns `bundle`.

### bundle.require(files)

Adds non-entry files to be included in `bundle`. Only necessary if you want to include files that aren’t referenced by any entry files, or are referenced dynamically (e.g. `require('foo' + bar)`);

Returns `bundle`.

### bundle.external(externalBundle)

Looks to `externalBundle` when resolving required paths/IDs, excluding all modules that exist in it from `bundle`. Obviously, `externalBundle` must be loaded on the page before anything that references it in `bundle` executes. Note that `externalBundle`’s externals will also be recursively checked, allowing a chain of dependencies to form.

Returns `bundle`.

### bundle.expose(file, id)

Calls `bundle.require` on `file` and aliases it as `id` for the current bundle and external bundles. `require(id)` will always takes precedence over normal path-resolution and always resolve to `file`.

Returns `bundle`.

### bundle.transform(transform[, options])

Adds browserify-compatible `transform` to execute on all file contents before being parsed for `require` calls.

By default, transforms are not run on any code contained within a `node_modules/` directory relative to any of the bundle’s entry files. yarb supports a `global` flag in `options` which serves the same purpose as the one in browserify and forces the transform to run on all code.

Returns `bundle`.

### bundle.bundle([callback])

Bundles everything together for the browser.

Returns a readable stream that can be piped to disk or elsewhere. If a node-style `callback` is given, it’ll execute on completion with the arguments `(error, buffer)`.

### bundle.has(path)

Returns `true` if the bundle includes the file located at `path` in its output, otherwise `false`. Will only give accurate results after `bundle()` is called.

## License

MIT
