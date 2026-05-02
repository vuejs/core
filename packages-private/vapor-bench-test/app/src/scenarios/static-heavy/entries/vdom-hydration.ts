import '../style.css'
import { createSSRApp } from 'vue'
import StaticHeavy from '../vue/Vdom.vue'

performance.mark('bench:entry-start')

createSSRApp(StaticHeavy).mount('#app')
