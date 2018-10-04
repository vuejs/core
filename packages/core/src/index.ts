// Core API
export { h, Fragment, Portal } from './h'
export { Component } from './component'
export { cloneVNode, createPortal, createFragment } from './vdom'
export { createRenderer } from './createRenderer'

// Observer API
export * from '@vue/observer'

// Scheduler API
export { nextTick } from '@vue/scheduler'

// Internal API
export { createComponentInstance } from './componentUtils'

// Optional APIs
// these are imported on-demand and can be tree-shaken
export { applyDirective } from './optional/directive'
export { Provide, Inject } from './optional/context'
export { createAsyncComponent } from './optional/asyncComponent'
export { KeepAlive } from './optional/keepAlive'

// flags & types
export { ComponentType, ComponentClass, FunctionalComponent } from './component'
export { ComponentOptions, PropType } from './componentOptions'
export { VNodeFlags, ChildrenFlags } from './flags'
export { VNode, Slots } from './vdom'
