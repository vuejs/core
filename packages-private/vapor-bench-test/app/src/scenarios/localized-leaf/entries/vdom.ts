import '../style.css'
import { createApp } from 'vue'
import LocalizedLeaf from '../vue/Vdom.vue'

performance.mark('bench:entry-start')

createApp(LocalizedLeaf).mount('#app')
