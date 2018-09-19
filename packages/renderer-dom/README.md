# @vue/renderer-dom

``` js
import { h, render, Component } from '@vue/renderer-dom'

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

render(
  h(App),
  document.getElementById('app')
)
```
