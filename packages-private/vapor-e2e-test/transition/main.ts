import { createVaporApp, vaporInteropPlugin } from 'vue'
import App from './App.vue'
import '../../../packages/vue/__tests__/e2e/style.css'
import './style.css'

// oxlint-disable-next-line no-restricted-globals
const params = new URLSearchParams(window.location.search)
const caseId = params.get('case')
if (!caseId) {
  throw new Error(
    '[transition] Missing "case" query param. Example: /transition/?case=transition-with-v-if/basic-transition',
  )
}
createVaporApp(App, { caseId }).use(vaporInteropPlugin).mount('#app')
