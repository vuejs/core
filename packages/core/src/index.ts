// render api
export { h, Fragment, Portal } from './h'
export { cloneVNode, createPortal, createFragment } from './vdom'
export { createRenderer } from './createRenderer'
export { Component } from './component'

// observer api
export * from '@vue/observer'

// scheduler api
export { nextTick } from '@vue/scheduler'

// internal api
export { createComponentInstance } from './componentUtils'

// import-on-demand apis
export { applyDirective } from './directive'
export { Provide, Inject } from './context'

// flags & types
export { ComponentClass, FunctionalComponent } from './component'
export { ComponentOptions, PropType } from './componentOptions'
export { VNodeFlags, ChildrenFlags } from './flags'
export { VNode, VNodeData, VNodeChildren, Key, Ref, Slots, Slot } from './vdom'
