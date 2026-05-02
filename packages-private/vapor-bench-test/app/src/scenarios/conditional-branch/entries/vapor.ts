import '../style.css'
import { createVaporApp } from 'vue'
import ConditionalBranch from '../vue/Vapor.vue'

performance.mark('bench:entry-start')

createVaporApp(ConditionalBranch as any).mount('#app')
