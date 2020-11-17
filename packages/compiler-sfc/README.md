# @vue/compiler-sfc

> Lower level utilities for compiling Vue single file components

This package contains lower level utilities that you can use if you are writing a plugin / transform for a bundler or module system that compiles Vue single file components into JavaScript. It is used in [vue-loader](https://github.com/vuejs/vue-loader), [rollup-plugin-vue](https://github.com/vuejs/rollup-plugin-vue) and [vite](https://github.com/vitejs/vite).

The API is intentionally low-level, because different toolings have different constraints on how much context is shared between the transformation of each block in an SFC. For example, the template sub-loader in `vue-loader` may not have access to the full SFC and its descriptor.

## Browser Build Notes

The browser build relies on a browser-bundled build of `postcss` to be available under the global `postcss` (since it can't be properly bundled by Rollup).

## Usage Example

```js
// TODO
```

For detailed APIs, check out the source type definitions.
