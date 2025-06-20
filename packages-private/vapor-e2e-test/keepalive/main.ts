import { createVaporApp, vaporInteropPlugin } from 'vue'
import App from './App.vue'

createVaporApp(App).use(vaporInteropPlugin).mount('#app')
