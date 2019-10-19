import { createRenderer } from '@vue/runtime-core'
import { isHTMLTag, isSVGTag } from '@vue/shared'
import { nodeOps } from './nodeOps'
import { patchProp } from './patchProp'

const { render, createApp } = createRenderer<Node, Element>({
  patchProp,
  ...nodeOps
})

const wrappedCreateApp = () => {
  const app = createApp()
  // inject `isNativeTag` dev only
  Object.defineProperty(app.config, 'isNativeTag', {
    value: (tag: string) => isHTMLTag(tag) || isSVGTag(tag),
    writable: false
  })
  return app
}

const exportedCreateApp = __DEV__ ? wrappedCreateApp : createApp

export { render, exportedCreateApp as createApp }

// DOM-only runtime helpers
export {
  vModelText,
  vModelCheckbox,
  vModelRadio,
  vModelSelect,
  vModelDynamic
} from './directives/vModel'

export { withModifiers, withKeys } from './directives/vOn'

// re-export everything from core
// h, Component, reactivity API, nextTick, flags & types
export * from '@vue/runtime-core'

// Type augmentations
export interface ComponentPublicInstance {
  $el: Element
}
