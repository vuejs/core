import { createComponentInstance, render, unmountComponent } from 'vue/vapor'
import { createApp } from 'vue'
import './style.css'

const modules = import.meta.glob<any>('./**/*.(vue|js)')
const mod = (modules['.' + location.pathname] || modules['./App.vue'])()

mod.then(({ default: mod }) => {
  if (mod.vapor) {
    const instance = createComponentInstance(mod, {})
    render(instance, '#app')
    // @ts-expect-error
    globalThis.unmount = () => {
      unmountComponent(instance)
    }
  } else {
    createApp(mod).mount('#app')
  }
})
