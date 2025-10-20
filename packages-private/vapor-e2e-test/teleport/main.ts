import { createVaporApp, vaporInteropPlugin } from 'vue'
import App from './App.vue'
import 'todomvc-app-css/index.css'

createVaporApp(App).use(vaporInteropPlugin).mount('#app')
