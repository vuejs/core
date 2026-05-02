import '../style.css'
import { createSSRApp } from 'vue'
import Dashboard from '../vue/Vdom.vue'

performance.mark('bench:entry-start')

createSSRApp(Dashboard).mount('#app')
