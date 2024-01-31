import { render, unmountComponent } from 'vue/vapor'

const modules = import.meta.glob<any>('./*.(vue|js)')
const mod = (modules['.' + location.pathname] || modules['./App.vue'])()

mod.then(({ default: mod }) => {
  const instance = render(mod, {}, '#app')
  // @ts-expect-error
  globalThis.unmount = () => {
    unmountComponent(instance)
  }
})
