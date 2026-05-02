import '../style.css'
import { createApp } from 'vue'
import ConditionalBranch from '../vue/Vdom.vue'

performance.mark('bench:entry-start')

createApp(ConditionalBranch).mount('#app')
