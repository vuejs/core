import { createApp } from 'vue'
import App from './App.vue'
import '@vue/repl/style.css'
;(window as any).process = { env: {} }

createApp(App).mount('#app')
