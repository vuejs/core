import { default as ToastComp } from './Toast.vue'
import { createApp } from 'vue'

const Toast = {
  show(msg: string, delay = 1000) {
    const ins = createApp(ToastComp, { msg })
    const container = document.createElement('div')
    ins.mount(container)
    document.body.appendChild(container)
    setTimeout(() => {
      ins.unmount()
      document.body.removeChild(container)
    }, delay)
  }
}

export default Toast
