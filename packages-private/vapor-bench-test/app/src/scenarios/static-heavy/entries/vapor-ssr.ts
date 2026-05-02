import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import StaticHeavy from '../vue/Vapor.vue'

export function render() {
  return renderToString(createSSRApp(StaticHeavy as any))
}
