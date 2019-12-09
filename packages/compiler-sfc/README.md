# @vue/compiler-sfc

> Lower level utilities for compiling Vue single file components

This package contains lower level utilities that you can use if you are writing a plugin / transform for a bundler or module system that compiles Vue single file components into JavaScript. It is used in [vue-loader](https://github.com/vuejs/vue-loader).

The API surface is intentionally minimal - the goal is to reuse as much as possible while being as flexible as possible.

## Why isn't `@vue/compiler-dom` a peerDependency?

Since this package is more often used as a low-level utility, it is usually a transitive dependency in an actual Vue project. It is therefore the responsibility of the higher-level package (e.g. `vue-loader`) to inject `@vue/compiler-dom` via options when calling the `compileTemplate` methods.

Not listing it as a peer dependency also allows tooling authors to use a custom template compiler (built on top of `@vue/compiler-core`) instead of `@vue/compiler-dom`, without having to include it just to fulfill the peer dep requirement.

## API

TODO
