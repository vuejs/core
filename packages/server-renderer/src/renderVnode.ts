import { VNode } from 'vue'
import { SSRBufferItem } from './renderToString'

export function renderVNode(
  push: (item: SSRBufferItem) => void,
  vnode: VNode
) {}

export function renderProps() {}

export function renderClass() {}

export function renderStyle() {}
