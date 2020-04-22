# @vue/runtime-test

This is for Vue's own internal tests only - it ensures logic tested using this package is DOM-agnostic, and it runs faster than JSDOM.

It can also be used as a reference for implementing a custom renderer.

``` js
import { h, render, nodeOps, dumpOps } from '@vue/runtime-test'

const App = {
  data () {
    return {
      msg: 'Hello World!'
    }
  }
  render () {
    return h('div', this.msg)
  }
}

// root is of type `TestElement` as defined in src/nodeOps.ts
const root = nodeOps.createElement('div')
render(h(App), root)

const ops = dumpOps()
console.log(ops)
```
