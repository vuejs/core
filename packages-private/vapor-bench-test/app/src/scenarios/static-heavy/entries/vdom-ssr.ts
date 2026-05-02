import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import StaticHeavy from '../vue/Vdom.vue'

export function render() {
  return renderToString(createSSRApp(StaticHeavy))
}
