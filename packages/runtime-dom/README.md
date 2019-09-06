# @vue/runtime-dom

``` js
import { h, createApp } from '@vue/runtime-dom'

const RootComponent = {
  render() {
    return h('div', 'hello world')
  }
}

createApp().mount(RootComponent, '#app')
```
