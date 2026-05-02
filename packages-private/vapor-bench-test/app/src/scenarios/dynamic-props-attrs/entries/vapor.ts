import '../style.css'
import { createVaporApp } from 'vue'
import DynamicPropsAttrs from '../vue/Vapor.vue'

performance.mark('bench:entry-start')

createVaporApp(DynamicPropsAttrs as any).mount('#app')
