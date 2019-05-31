export {
  VNode,
  openBlock,
  createBlock,
  createVNode,
  Text,
  Empty,
  Fragment,
  Portal
} from './vnode'

export { FunctionalComponent, createComponent } from './component'

export { Slot, Slots } from './componentSlots'

export { PropType, ComponentPropsOptions } from './componentProps'

export * from './reactivity'
export * from './componentLifecycle'
export { createRenderer, RendererOptions } from './createRenderer'

export { TEXT, CLASS, STYLE, PROPS, KEYED, UNKEYED } from './patchFlags'
