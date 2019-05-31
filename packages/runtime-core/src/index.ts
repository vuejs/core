export {
  VNode,
  openBlock,
  createBlock,
  createVNode,
  Fragment,
  Portal
} from './vnode'

export {
  ComponentOptions,
  FunctionalComponent,
  createComponent
} from './component'

export { Slot, Slots } from './componentSlots'

export { ComponentPropsOptions } from './componentProps'

export * from './reactivity'
export * from './componentLifecycle'
export { createRenderer, RendererOptions } from './createRenderer'

export { TEXT, CLASS, STYLE, PROPS, KEYED, UNKEYED } from './patchFlags'
