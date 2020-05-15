# @vue/server-renderer

``` js
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
