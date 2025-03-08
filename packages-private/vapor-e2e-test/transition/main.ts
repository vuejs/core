import { createVaporApp, vaporInteropPlugin } from 'vue'
import App from './App.vue'
import './style.css'

createVaporApp(App).use(vaporInteropPlugin).mount('#app')
