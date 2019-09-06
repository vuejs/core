# @vue/runtime-core

> This package is published only for typing and building custom renderers. It is NOT meant to be used in applications.

For full exposed APIs, see `src/index.ts`. You can also run `yarn build runtime-core --types` from repo root, which will generate an API report at `temp/runtime-core.api.md`.

## Building a Custom Renderer

``` ts
import { createRenderer, createAppAPI } from '@vue/runtime-core'

// low-level render method
export const render = createRenderer({
  pathcProp,
  insert,
  remove,
  createElement,
  // ...
})

export const createApp = createAppAPI(render)

export * from '@vue/runtime-core'
```

See `@vue/runtime-dom` for how a DOM-targeting renderer is implemented.
