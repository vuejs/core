import '../style.css'
import { createApp } from 'vue'
import StaticHeavy from '../vue/Vdom.vue'

performance.mark('bench:entry-start')

createApp(StaticHeavy).mount('#app')
