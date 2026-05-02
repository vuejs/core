import '../style.css'
import { createVaporApp } from 'vue'
import Dashboard from '../vue/Vapor.vue'

performance.mark('bench:entry-start')

createVaporApp(Dashboard as any).mount('#app')
