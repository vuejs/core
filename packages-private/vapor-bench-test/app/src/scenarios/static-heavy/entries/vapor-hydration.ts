import '../style.css'
import { createVaporSSRApp } from 'vue'
import StaticHeavy from '../vue/Vapor.vue'

performance.mark('bench:entry-start')

createVaporSSRApp(StaticHeavy as any).mount('#app')
