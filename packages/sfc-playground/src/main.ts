import { createApp } from 'vue'
import '@vue/repl/style.css'
import './style.css'
import App from './App.vue'

// @ts-expect-error Custom window property
window.VUE_DEVTOOLS_CONFIG = {
  defaultSelectedAppId: 'repl'
}

createApp(App).mount('#app')
