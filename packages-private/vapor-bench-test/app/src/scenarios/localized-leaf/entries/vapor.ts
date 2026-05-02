import '../style.css'
import { createVaporApp } from 'vue'
import LocalizedLeaf from '../vue/Vapor.vue'

performance.mark('bench:entry-start')

createVaporApp(LocalizedLeaf as any).mount('#app')
