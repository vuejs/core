import { render } from 'vue/vapor'
import App from './App.vue'

render(() => {
  // @ts-expect-error
  const returned = App.setup({}, { expose() {} })
  return App.render(returned)
}, '#app')
