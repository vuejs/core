import '../style.css'
import { createApp } from 'vue'
import DynamicPropsAttrs from '../vue/Vdom.vue'

performance.mark('bench:entry-start')

createApp(DynamicPropsAttrs).mount('#app')
