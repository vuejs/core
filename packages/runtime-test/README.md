# @vue/runtime-test

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
