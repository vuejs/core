# vue-next [![CircleCI](https://circleci.com/gh/vuejs/vue-next.svg?style=svg&circle-token=fb883a2d0a73df46e80b2e79fd430959d8f2b488)](https://circleci.com/gh/vuejs/vue-next)

## Status: Pre-Alpha.

We have achieved most of the architectural goals and new features planned for v3:

- Compiler
  - [x] Modular architecture
  - [x] "Block tree" optimization
  - [x] More aggressive static tree hoisting
  - [x] Source map support
  - [x] Built-in identifier prefixing (aka "stripWith")
  - [x] Built-in pretty-printing
  - [x] Lean ~10kb brotli-compressed browser build after dropping source map and identifier prefixing

- Runtime
  - [x] Significantly faster
  - [x] Simultaneous Composition API + Options API support, **with typings**
  - [x] Proxy-based change detection
  - [x] Fragments
  - [x] Portals
  - [x] Suspense w/ `async setup()`

However, there are still some 2.x parity features not completed yet:

- [ ] Server-side rendering
- [ ] `<keep-alive>`
- [ ] `<transition>`
- [ ] Compiler DOM-specific transforms
  - [ ] `v-on` DOM modifiers
  - [ ] `v-model`
  - [ ] `v-text`
  - [ ] `v-pre`
  - [ ] `v-once`
  - [ ] `v-html`
  - [ ] `v-show`

The current implementation also requires native ES2015+ in the runtime environment and does not support IE11 (yet).

## Contribution

See [Contributing Guide](https://github.com/vuejs/vue-next/blob/master/.github/contributing.md).
