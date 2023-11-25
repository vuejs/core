import { render } from 'vue/vapor'

const modules = import.meta.glob<any>('./*.vue')
const mod = (modules['.' + location.pathname] || modules['./App.vue'])()

mod.then(({ default: m }) => {
  render(() => {
    const returned = m.setup?.({}, { expose() {} })
    return m.render(returned)
  }, '#app')
})
