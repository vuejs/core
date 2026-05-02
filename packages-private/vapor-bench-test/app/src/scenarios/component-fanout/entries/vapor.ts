import '../style.css'
import { createVaporApp } from 'vue'
import ComponentFanout from '../vue/Vapor.vue'

performance.mark('bench:entry-start')

createVaporApp(ComponentFanout as any).mount('#app')
