import '../style.css'
import { createApp } from 'vue'
import Dashboard from '../vue/Vdom.vue'

performance.mark('bench:entry-start')

createApp(Dashboard).mount('#app')
