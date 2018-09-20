# @vue/core

> This package is published only for typing and building custom renderers. It is NOT meant to be used in applications.

``` ts
import { createRenderer, h } from '@vue/core'

const { render } = createRenderer({
  queueJob,
  nodeOps,
  patchData,
  teardownVNode
})

render(h('div'), container)
```
