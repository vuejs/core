import '../style.css'
import { createVaporApp } from 'vue'
import StaticHeavy from '../vue/Vapor.vue'

performance.mark('bench:entry-start')

createVaporApp(StaticHeavy as any).mount('#app')
