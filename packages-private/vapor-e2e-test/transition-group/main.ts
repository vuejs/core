import { createVaporApp, vaporInteropPlugin } from 'vue'
import App from './App.vue'
import '../../../packages/vue/__tests__/e2e/style.css'

createVaporApp(App).use(vaporInteropPlugin).mount('#app')
