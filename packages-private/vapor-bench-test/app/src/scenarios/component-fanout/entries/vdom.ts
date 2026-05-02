import '../style.css'
import { createApp } from 'vue'
import ComponentFanout from '../vue/Vdom.vue'

performance.mark('bench:entry-start')

createApp(ComponentFanout).mount('#app')
