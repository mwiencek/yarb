# yarb

yarb performs mostly the same task as [browserify](https://github.com/substack/node-browserify), and uses mostly the same internals: [browser-pack](https://github.com/substack/browser-pack), [node-browser-resolve](https://github.com/defunctzombie/node-browser-resolve), [node-detective](https://github.com/substack/node-detective).

yarb is much less flexible than browserify, but better at defining dependencies between bundles. In browserify, sharing files between bundles tends to require a lot of manual `expose` and `external` settings on each file. A yarb bundle’s `external` function only accepts other bundles as input, and the bundling process knows exactly which files are common to both.

While yarb shares API similarities with browserify and is even compatible with browserify transforms, it does not handle node builtins (you’ll need [envify](https://github.com/hughsk/envify) to replace references to `process.env`, for example), nor does it include many other settings and behaviors that browserify does.

This project served two purposes for me: (1) fixing a frustation after failing to patch browserify to suit my needs, and (2) learning better how to write node modules. Use browserify unless you know what you’re doing.

## Notes

Internally, yarb stores files as [vinyl](https://github.com/wearefractal/vinyl) objects, and even accepts these as input wherever a path is accepted. This allows passing in existing buffers/streams by just wrapping them in vinyl objects beforehand.

The catch is that all vinyls must have a `path` property that is both unique to the bundle and absolute (though it doesn't have to exist on disk). Paths are how modules reference each other, after all (even `browser` field IDs must resolve to paths), with one exception: the `expose` method could theoretically support exposing a vinyl buffer/stream as an arbitrary ID, since those always take precedence over paths. That’d be a rare case, since the vast majority of things will be sourced from disk. Giving a fake but unique path where one doesn't exist will otherwise suffice.

## License

MIT
