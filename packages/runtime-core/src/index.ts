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

export { nextTick } from './scheduler'
export { createComponent, FunctionalComponent } from './component'
export { createRenderer, RendererOptions } from './createRenderer'
export { Slot, Slots } from './componentSlots'
export { PropType, ComponentPropsOptions } from './componentProps'

export * from './reactivity'
export * from './componentLifecycle'
export * from './patchFlags'
export * from './typeFlags'
