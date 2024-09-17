/// <reference types="vite/client" />

import { createVaporApp } from 'vue/vapor'
import { createApp } from 'vue'
import './style.css'

const modules = import.meta.glob<any>('./**/*.(vue|js)')
const mod = (modules['.' + location.pathname] || modules['./App.vue'])()

mod.then(({ default: mod }) => {
  const app = (mod.vapor ? createVaporApp : createApp)(mod)
  app.mount('#app')

  // @ts-expect-error
  globalThis.unmount = () => {
    app.unmount()
  }
})
