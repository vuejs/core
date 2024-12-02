import { createComponentSimple, createVaporAppSimple } from 'vue/vapor'
import List from './list'
import Props from './props'
import './style.css'

const s = performance.now()
const app = createVaporAppSimple({
  setup() {
    return [createComponentSimple(Props), createComponentSimple(List)]
  },
})
app.mount('#app')
console.log((performance.now() - s).toFixed(2))
