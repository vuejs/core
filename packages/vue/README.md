# vue

## Which dist file to use?

### From CDN or without a Bundler

- **`vue(.runtime).global(.prod).js`**:
  - For direct use via `<script src="...">` in the browser. Exposes the `Vue` global.
  - Note that global builds are not [UMD](https://github.com/umdjs/umd) builds.  They are built as [IIFEs](https://developer.mozilla.org/en-US/docs/Glossary/IIFE) and is only meant for direct use via `<script src="...">`.
  - In-browser template compilation:
    - **`vue.global.js`** is the "full" build that includes both the compiler and the runtime so it supports compiling templates on the fly.
    - **`vue.runtime.global.js`** contains only the runtime and requires templates to be pre-compiled during a build step.
  - Inlines all Vue core internal packages - i.e. it's a single file with no dependencies on other files. This means you **must** import everything from this file and this file only to ensure you are getting the same instance of code.
  - Contains hard-coded prod/dev branches, and the prod build is pre-minified. Use the `*.prod.js` files for production.

- **`vue(.runtime).esm-browser(.prod).js`**:
  - For usage via native ES modules imports (in browser via `<script type="module">`.
  - Shares the same runtime compilation, dependency inlining and hard-coded prod/dev behavior with the global build.

### With a Bundler

- **`vue(.runtime).esm-bundler.js`**:

  - For use with bundlers like `webpack`, `rollup` and `parcel`.
  - Leaves prod/dev branches with `process.env.NODE_ENV` guards (must be replaced by bundler)
  - Does not ship minified builds (to be done together with the rest of the code after bundling)
  - Imports dependencies (e.g. `@vue/runtime-core`, `@vue/runtime-compiler`)
    - Imported dependencies are also `esm-bundler` builds and will in turn import their dependencies (e.g. `@vue/runtime-core` imports `@vue/reactivity`)
    - This means you **can** install/import these deps individually without ending up with different instances of these dependencies, but you must make sure they all resolve to the same version.
  - In-browser template compilation:
    - **`vue.runtime.esm-bundler.js` (default)** is runtime only, and requires all templates to be pre-compiled. This is the default entry for bundlers (via `module` field in `package.json`) because when using a bundler templates are typically pre-compiled (e.g. in `*.vue` files).
    - **`vue.esm-bundler.js`**: includes the runtime compiler. Use this if you are using a bundler but still want runtime template compilation (e.g. in-DOM templates or templates via inline JavaScript strings). You will need to configure your bundler to alias `vue` to this file.

#### Bundler Build Feature Flags

Starting with 3.0.0-rc.3, `esm-bundler` builds now exposes global feature flags that can be overwritten at compile time:

- `__VUE_OPTIONS_API__` (enable/disable Options API support, default: `true`)
- `__VUE_PROD_DEVTOOLS__` (enable/disable devtools support in production, default: `false`)

The build will work without configuring these flags, however it is **strongly recommended** to properly configure them in order to get proper tree-shaking in the final bundle. To configure these flags:

- webpack: use [DefinePlugin](https://webpack.js.org/plugins/define-plugin/)
- Rollup: use [@rollup/plugin-replace](https://github.com/rollup/plugins/tree/master/packages/replace)
- Vite: configured by default, but can be overwritten using the [`define` option](https://github.com/vitejs/vite/blob/a4133c073e640b17276b2de6e91a6857bdf382e1/src/node/config.ts#L72-L76)

Note: the replacement value **must be boolean literals** and cannot be strings, otherwise the bundler/minifier will not be able to properly evaluate the conditions.

### For Server-Side Rendering

- **`vue.cjs(.prod).js`**:
  - For use in Node.js server-side rendering via `require()`.
  - If you bundle your app with webpack with `target: 'node'` and properly externalize `vue`, this is the build that will be loaded.
    Note that `@vue/server-renderer` needs to be externalized as well.
  - The dev/prod files are pre-built, but the appropriate file is automatically required based on `process.env.NODE_ENV`.
