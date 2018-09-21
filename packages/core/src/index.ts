// render api
export { h, Fragment, Portal } from './h'
export { cloneVNode, createPortal, createFragment } from './vdom'
export { createRenderer } from './createRenderer'

import { Component as InternalComponent, ComponentClass } from './component'
// the public component constructor with proper type inference.
export const Component = InternalComponent as ComponentClass

// observer api
export * from '@vue/observer'

// scheduler api
export { nextTick } from '@vue/scheduler'

// internal api
export { createComponentInstance } from './componentUtils'

// flags & types
export { ComponentClass, FunctionalComponent } from './component'
export { ComponentOptions, PropType } from './componentOptions'
export { VNodeFlags, ChildrenFlags } from './flags'
export { VNode, VNodeData, VNodeChildren, Key, Ref, Slots, Slot } from './vdom'
