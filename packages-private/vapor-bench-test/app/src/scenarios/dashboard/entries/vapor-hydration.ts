import '../style.css'
import { createVaporSSRApp } from 'vue'
import Dashboard from '../vue/Vapor.vue'

performance.mark('bench:entry-start')

createVaporSSRApp(Dashboard as any).mount('#app')
