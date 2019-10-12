import { createRenderer } from '@vue/runtime-core'
import { nodeOps } from './nodeOps'
import { patchProp } from './patchProp'

const { render, createApp } = createRenderer<Node, Element>({
  patchProp,
  ...nodeOps
})

export { render, createApp }

// DOM-only runtime helpers
export {
  vModelText,
  vModelCheckbox,
  vModelRadio,
  vModelSelect,
  vModelDynamic
} from './directives/vModel'

// re-export everything from core
// h, Component, reactivity API, nextTick, flags & types
export * from '@vue/runtime-core'

// Type augmentations
export interface ComponentPublicInstance {
  $el: Element
}
