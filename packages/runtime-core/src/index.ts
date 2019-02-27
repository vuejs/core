// Core API
export { h, Fragment, Portal } from './h'
export { Component } from './component'
export {
  cloneVNode,
  createElementVNode,
  createComponentVNode,
  createTextVNode,
  createFragment,
  createPortal
} from './vdom'
export {
  createRenderer,
  NodeOps,
  PatchDataFunction,
  RendererOptions
} from './createRenderer'

// Observer API
export * from '@vue/observer'

// Scheduler API
export { nextTick } from '@vue/scheduler'

// Optional APIs
// these are imported on-demand and can be tree-shaken
export { applyDirectives } from './optional/directives'
export { Provide, Inject } from './optional/context'
export { createAsyncComponent } from './optional/asyncComponent'
export { KeepAlive } from './optional/keepAlive'
export { mixins } from './optional/mixins'
export { EventEmitter } from './optional/eventEmitter'
export { memoize } from './optional/memoize'
export { prop } from './optional/propDecorator'

// flags & types
export { ComponentType, ComponentClass, FunctionalComponent } from './component'
export { VNodeFlags, ChildrenFlags } from './flags'
export { VNode, Slots } from './vdom'

// Internal API, for libraries or renderers that need to perform low level work
export * from './componentOptions'
export { createComponentInstance } from './componentInstance'
