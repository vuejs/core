# vue

## Which dist file to use?

### From CDN or without a Bundler

- **`vue(.runtime).global(.prod).js`**:
  - For direct use via `<script src="...">` in the browser. Exposes the `Vue` global.
  - Note: global builds are not [UMD](https://github.com/umdjs/umd) builds.  They are built as [IIFEs](https://developer.mozilla.org/en-US/docs/Glossary/IIFE) and is only meant for direct use via `<script src>`.
  - **`vue.global.js`**: the "full" build that supports compiling templates on the fly.
  - **`vue.runtime.global.js`**: runtime only, does not include runtime template compilation support. Use this if you are not using a bundler, but somehow pre-compiling your template.

- **`vue.esm(.prod).js`**:
  - For usage via native ES modules imports (in browser via `<script type="module">`, or via Node.js native ES modules support in the future)
  - Inlines all dependencies - i.e. it's a single ES module with no imports from other files
    - this means you **must** import everything from this file and this file only to ensure you are getting the same instance of code.
  - Hard-coded prod/dev branches, and the prod build is pre-minified (you will need to use different files for dev/prod)

### With a Bundler

- **`vue(.runtime).esm-bundler.js`**:
  - For use with bundlers like `webpack`, `rollup` and `parcel`.
  - Leaves prod/dev branches with `process.env.NODE_ENV` guards (must be replaced by bundler)
  - Does not ship minified builds (to be done together with the rest of the code after bundling)
  - imports dependencies (e.g. `@vue/runtime-core`, `@vue/runtime-compiler`)
    - imported dependencies are also `esm-bundler` builds and will in turn import their dependencies (e.g. `@vue/runtime-core` imports `@vue/reactivity`)
    - this means you **can** install/import these deps individually without ending up with different instances of these dependencies.
  - **`vue.runtime.esm-bundler.js`**: runtime only, does not include runtime template compilation support. **This is the default entry for bundlers (via `module` field in `package.json`)** because when using a bundler templates are typically pre-compiled (e.g. in `*.vue` files).
  - **`vue.esm-bundler.js`**: includes the runtime compiler. Use this if you are using a bundler but still want runtime template compilation (e.g. in-DOM templates or templates via inline JavaScript strings).

### For Server-Side Rendering

- **`vue.cjs(.prod).js`**:
  - For use in Node.js server-side rendering via `require()`.
  - If you bundle your app with webpack with `target: 'node'` and properly externalize `vue`, this is the build that will be loaded.
  - The dev/prod files are pre-built, but the appropriate file is automatically required based on `process.env.NODE_ENV`.
