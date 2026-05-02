import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import Dashboard from '../vue/Vapor.vue'

export function render() {
  return renderToString(createSSRApp(Dashboard as any))
}
