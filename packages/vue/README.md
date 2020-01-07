# vue

## Which dist file to use?

- **`vue.global(.prod).js`**:
  - For direct use via `<script src="...">` in the browser. Exposes the `Vue` global.
  - Note: global builds are not [UMD](https://github.com/umdjs/umd) builds. Instead they are built as [IIFEs](https://developer.mozilla.org/en-US/docs/Glossary/IIFE).

- **`*vue(.runtime).esm-bundler.js`**:
  - For use with bundlers like `webpack`, `rollup` and `parcel`.
  - Leaves prod/dev branches with `process.env.NODE_ENV` guards (must be replaced by bundler)
  - Does not ship minified builds (to be done together with the rest of the code after bundling)
  - imports dependencies (e.g. `@vue/runtime-core`, `@vue/runtime-compiler`)
    - imported depdencies are also `esm-bundler` builds and will in turn import their dependencies (e.g. `@vue/runtime-core` imports `@vue/reactivity`)
    - this means you **can** install/import these deps individually without ending up with different instances of these dependencies.
  - **`vue.runtime.esm-bundler.js`**: runtime only, does not include runtime template compilation support. **This is the default entry for bundlers (via `module` field in `package.json`)** because when using a bundler templates are typically pre-compiled (e.g. in `*.vue` files).
  - **`vue.esm-bundler.js`**: includes the runtime compiler. Use this if you are using a bundler but still want runtime template compilation (e.g. in-DOM templates or templates via inline JavaScript strings).

- **`vue.esm(.prod).js`**:
  - For usage via native ES modules imports (in browser via `<script type="module">`, or via Node.js native ES modules support in the future)
  - Inlines all dependencies - i.e. it's a single ES module with no imports from other files
    - this means you **must** import everything from this file nad this file only to ensure you are getting the same instance of code.
  - Hard-coded prod/dev branches, and the prod build is pre-minified (you will need to use different files for dev/prod)

- **`vue.cjs(.prod).js`**:
  - For use in Node.js server-side rendering via `require()`.
  - The dev/prod files are pre-built, but are dynamically required based on `process.env.NODE_ENV` in `index.js`, which is the default entry when you do `require('vue')`.
