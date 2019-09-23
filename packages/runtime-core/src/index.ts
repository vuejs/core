// Public API ------------------------------------------------------------------

export { createComponent } from './apiCreateComponent'
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
export { Text, Empty, Fragment, Portal, Suspense } from './vnode'
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

// Internal, for compiler generated code
export { applyDirectives } from './directives'
export { resolveComponent, resolveDirective } from './helpers/resolveAssets'
export { renderList } from './helpers/renderList'
export { capitalize } from '@vue/shared'

// Internal, for integration with runtime compiler
export { registerRuntimeCompiler } from './component'

// Types -----------------------------------------------------------------------

export { App, AppConfig, AppContext, Plugin } from './apiApp'
export { RawProps, RawChildren, RawSlots } from './h'
export { VNode, VNodeTypes } from './vnode'
export {
  Component,
  FunctionalComponent,
  ComponentInternalInstance,
  RenderFunction
} from './component'
export {
  ComponentOptions,
  ComponentOptionsWithoutProps,
  ComponentOptionsWithProps,
  ComponentOptionsWithArrayProps
} from './componentOptions'

export { ComponentPublicInstance } from './componentPublicInstanceProxy'
export { RendererOptions } from './createRenderer'
export { Slot, Slots } from './componentSlots'
export { Prop, PropType, ComponentPropsOptions } from './componentProps'
export {
  Directive,
  DirectiveBinding,
  DirectiveHook,
  DirectiveArguments
} from './directives'
export { SuspenseBoundary } from './suspense'
