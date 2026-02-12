import { createVaporApp, vaporInteropPlugin } from 'vue'
import App from './App.vue'
import '../../../packages/vue/__tests__/e2e/style.css'
import './style.css'

// oxlint-disable-next-line
;(window as any).__VUE_VAPOR_E2E_TEST__ = true

createVaporApp(App).use(vaporInteropPlugin).mount('#app')
