# yarb

yarb performs mostly the same task as [browserify](https://github.com/substack/node-browserify), and uses mostly the same internals: [browser-pack](https://github.com/substack/browser-pack), [node-browser-resolve](https://github.com/defunctzombie/node-browser-resolve), [node-detective](https://github.com/substack/node-detective).

yarb is much less flexible than browserify, but better at defining dependencies between bundles. In browserify, sharing files between bundles tends to require a lot of manual `expose` and `external` settings on each file. A yarb bundle’s `external` function only accepts other bundles as input, and the bundling process knows exactly which files are common to both.

While yarb shares API similarities with browserify and is even compatible with browserify transforms, it does not handle node builtins (you’ll need [envify](https://github.com/hughsk/envify) to replace references to `process.env`, for example), nor does it include many other settings and behaviors that browserify does.

This project served two purposes for me: (1) fixing a frustation after failing to patch browserify to suit my needs, and (2) learning better how to write node modules. Use browserify unless you know what you’re doing.

## Notes

Internally, yarb stores files as [vinyl](https://github.com/wearefractal/vinyl) objects, and even accepts these as input wherever a path is accepted. This allows passing in existing buffers/streams by just wrapping them in vinyl objects beforehand.

The catch is that all vinyls must have a `path` property that is both unique to the bundle and absolute (though it doesn't have to exist on disk). Paths are how modules reference each other, after all (even `browser` field IDs must resolve to paths), with one exception: the `expose` method could theoretically support exposing a vinyl buffer/stream as an arbitrary ID, since those always take precedence over paths. That’d be a rare case, since the vast majority of things will be sourced from disk. Giving a fake but unique path where one doesn't exist will otherwise suffice.

## API

### var bundle = yarb([files [, options]])

Returns a new bundle with `files` as entry points, i.e. modules executed when the bundle is loaded. `files` can be a single file or an array of files consisting of paths or vinyl objects.

Current `options` are: `debug`, which enables source maps.

### bundle.add(files)

Adds additional entry files to `bundle`. See above for accepted inputs for `files`.

Returns `bundle`.

### bundle.require(files)

Adds non-entry files to be included in `bundle`. Only necessary if you want to include files that aren’t referenced by any entry files, or are referenced dynamically (e.g. `require('foo' + bar)`);

Returns `bundle`.

### bundle.external(externalBundle)

Looks to `externalBundle` when resolving required paths/IDs, excluding all modules that exist in it. Obviously, `externalBundle` must be loaded on the page before anything in `bundle` that references it executes.

Returns `bundle`.

### bundle.expose(file, id)

Calls `bundle.require` on `file` and aliases it as `id` for the current bundle and external bundles. `require(id)` will always takes precedence over normal path-resolution and always resolve to `file`.

Returns `bundle`.

### bundle.transform(transform)

Adds browserify-compatible `transform` to execute on all file contents before being parsed for `require` calls.

Returns `bundle`.

### bundle.bundle([callback])

Bundles everything together for the browser.

Returns a readable stream that can be piped to disk or elsewhere. If a node-style `callback` is given, it’ll execute on completion with the arguments `(error, buffer)`.

## License

MIT
