# @vue/runtime-test

``` js
import {
  h,
  render,
  Component,
  nodeOps,
  startRecordingOps,
  dumpOps
} from '@vue/runtime-test'

class App extends Component {
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

startRecordingOps()

render(h(App), root)

const ops = dumpOps()

console.log(ops)
```
