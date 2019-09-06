# @vue/runtime-core

> This package is published only for typing and building custom renderers. It is NOT meant to be used in applications.

For full exposed APIs, see `src/index.ts`. You can also run `yarn build runtime-core --types` from repo root, which will generate an API report at `temp/runtime-core.api.md`.

## Building a Custom Renderer

``` ts
import { createRenderer, createAppAPI } from '@vue/runtime-core'

const { render, createApp } = createRenderer({
  pathcProp,
  insert,
  remove,
  createElement,
  // ...
})

// `render` is the low-level API
// `createApp` returns an app instance with configurable context shared
// by the entire app tree.
export { render, createApp }

export * from '@vue/runtime-core'
```

See `@vue/runtime-dom` for how a DOM-targeting renderer is implemented.
