# yarb

yarb performs mostly the same task as [browserify](https://github.com/substack/node-browserify), and uses mostly the same internals: [browser-pack](https://github.com/substack/browser-pack), [node-browser-resolve](https://github.com/defunctzombie/node-browser-resolve), [node-detective](https://github.com/substack/node-detective).

yarb is much less flexible than browserify, but better at defining dependencies between bundles. In browserify, sharing files between bundles tends to require a lot of manual `expose` and `external` settings on each file. A yarb bundle’s `external` function only accepts other bundles as input, and the bundling process knows exactly which files are common to both.

While yarb shares API similarities with browserify and is even compatible with browserify transforms, it does not handle node builtins (you’ll need [envify](https://github.com/hughsk/envify) to replace references to `process.env`, for example), nor does it include many other settings and behaviors that browserify does.

This project served two purposes for me: (1) fixing a frustation after failing to patch browserify to suit my needs, and (2) learning better how to write node modules. Use browserify unless you know what you're doing.

## License

MIT
