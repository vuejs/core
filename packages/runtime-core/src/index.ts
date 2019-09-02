// Public API ------------------------------------------------------------------

export { createComponent } from './component'
export { nextTick } from './scheduler'
export * from './apiReactivity'
export * from './apiWatch'
export * from './apiLifecycle'
export * from './apiInject'

// Advanced API ----------------------------------------------------------------

// For raw render function users
export { h } from './h'
export {
  createVNode,
  cloneVNode,
  mergeProps,
  openBlock,
  createBlock
} from './vnode'
// VNode type symbols
export { Text, Empty, Fragment, Portal } from './vnode'
// VNode flags
export { PublicPatchFlags as PatchFlags } from './patchFlags'
export { PublicShapeFlags as ShapeFlags } from './shapeFlags'

// For advanced plugins
export { getCurrentInstance } from './component'

// For custom renderers
export { createRenderer } from './createRenderer'
export {
  handleError,
  callWithErrorHandling,
  callWithAsyncErrorHandling
} from './errorHandling'

// For the compiler
export { applyDirectives, resolveDirective } from './directives'

// Types -----------------------------------------------------------------------

export { VNode } from './vnode'
export { FunctionalComponent, ComponentInstance } from './component'
export { RendererOptions } from './createRenderer'
export { Slot, Slots } from './componentSlots'
export { PropType, ComponentPropsOptions } from './componentProps'
export { Directive, DirectiveBinding, DirectiveHook } from './directives'
