import { render } from 'vue/vapor'
import App from './App.vue'

render(() => {
  // @ts-expect-error
  const returned = App.setup({}, { expose() {} })
  // @ts-expect-error
  return App.render(returned)
}, '#app')
