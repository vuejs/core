import {
  createRenderer,
  warn,
  App,
  RootRenderFunction
} from '@vue/runtime-core'
import { nodeOps } from './nodeOps'
import { patchProp } from './patchProp'
// Importing from the compiler, will be tree-shaken in prod
import { isFunction, isString, isHTMLTag, isSVGTag } from '@vue/shared'

const { render: baseRender, createApp: baseCreateApp } = createRenderer({
  patchProp,
  ...nodeOps
})

// use explicit type casts here to avoid import() calls in rolled-up d.ts
export const render = baseRender as RootRenderFunction<Node, Element>

export const createApp = (): App<Element> => {
  const app = baseCreateApp()

  if (__DEV__) {
    // Inject `isNativeTag`
    // this is used for component name validation (dev only)
    Object.defineProperty(app.config, 'isNativeTag', {
      value: (tag: string) => isHTMLTag(tag) || isSVGTag(tag),
      writable: false
    })
  }

  const mount = app.mount
  app.mount = (component, container, props): any => {
    if (isString(container)) {
      container = document.querySelector(container)!
      if (!container) {
        __DEV__ &&
          warn(`Failed to mount app: mount target selector returned null.`)
        return
      }
    }
    if (
      __RUNTIME_COMPILE__ &&
      !isFunction(component) &&
      !component.render &&
      !component.template
    ) {
      component.template = container.innerHTML
    }
    // clear content before mounting
    container.innerHTML = ''
    return mount(component, container, props)
  }

  return app
}

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
