import { createApp, vaporInteropPlugin } from 'vue'
import App from './App.vue'
import '../transition/style.css'

createApp(App).use(vaporInteropPlugin).mount('#app')
