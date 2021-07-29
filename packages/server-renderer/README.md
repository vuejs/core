# @vue/server-renderer

## Basic API

### `renderToString`

**Signature**

```ts
function renderToString(
  input: App | VNode,
  context?: SSRContext
): Promise<string>
```

**Usage**

```js
const { createSSRApp } = require('vue')
const { renderToString } = require('@vue/server-renderer')

const app = createSSRApp({
  data: () => ({ msg: 'hello' }),
  template: `<div>{{ msg }}</div>`
})

;(async () => {
  const html = await renderToString(app)
  console.log(html)
})()
```

### Handling Teleports

If the rendered app contains teleports, the teleported content will not be part of the rendered string. Instead, they are exposed under the `teleports` property of the ssr context object:

```js
const ctx = {}
const html = await renderToString(app, ctx)

console.log(ctx.teleports) // { '#teleported': 'teleported content' }
```

## Streaming API

### `renderToNodeStream`

Renders input as a [Node.js Readable stream](https://nodejs.org/api/stream.html#stream_class_stream_readable).

**Signature**

```ts
function renderToNodeStream(input: App | VNode, context?: SSRContext): Readable
```

**Usage**

```js
// inside a Node.js http handler
renderToNodeStream(app).pipe(res)
```

In the ESM build of `@vue/server-renderer`, which is decoupled from Node.js environments, the `Readable` constructor must be explicitly passed in as the 3rd argument:

```js
import { Readable } from 'stream'

renderToNodeStream(app, {}, Readable).pipe(res)
```

### `renderToWebStream`

Renders input as a [Web ReadableStream](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API).

**Signature**

```ts
function renderToWebStream(
  input: App | VNode,
  context?: SSRContext,
  Ctor?: { new (): ReadableStream }
): ReadableStream
```

**Usage**

```js
// e.g. inside a Cloudflare Worker
return new Response(renderToWebStream(app))
```

Note in environments that do not expose `ReadableStream` constructor in the global scope, the constructor must be explicitly passed in as the 3rd argument. For example in Node.js 16.5.0+ where web streams are also supported:

```js
import { ReadableStream } from 'stream/web'

const stream = renderToWebStream(app, {}, ReadableStream)
```

## `renderToSimpleStream`

Renders input in streaming mode using a simple readable interface.

**Signature**

```ts
function renderToSimpleStream(
  input: App | VNode,
  context: SSRContext,
  options: SimpleReadable
): SimpleReadable

interface SimpleReadable {
  push(content: string | null): void
  destroy(err: any): void
}
```

**Usage**

```js
let res = ''

renderToSimpleStream(
  app,
  {},
  {
    push(chunk) {
      if (chunk === null) {
        // done
        console(`render complete: ${res}`)
      } else {
        res += chunk
      }
    },
    destroy(err) {
      // error encountered
    }
  }
)
```
