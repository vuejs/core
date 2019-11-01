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
export { Text, Comment, Fragment, Portal, Suspense } from './vnode'
// Internal Components
export { KeepAlive } from './keepAlive'
// VNode flags
export { PublicShapeFlags as ShapeFlags } from './shapeFlags'
import { PublicPatchFlags } from '@vue/shared'
export const PatchFlags = PublicPatchFlags as {
  // export patch flags as plain numbers to avoid d.ts relying on @vue/shared
  // the enum type is internal anyway.
  TEXT: number
  CLASS: number
  STYLE: number
  PROPS: number
  NEED_PATCH: number
  FULL_PROPS: number
  KEYED_FRAGMENT: number
  UNKEYED_FRAGMENT: number
  DYNAMIC_SLOTS: number
  BAIL: number
}

// For advanced plugins
export { getCurrentInstance } from './component'

// For custom renderers
export { createRenderer, RootRenderFunction } from './createRenderer'
export { warn } from './warning'
export {
  handleError,
  callWithErrorHandling,
  callWithAsyncErrorHandling
} from './errorHandling'

// Internal, for compiler generated code
// should sync with '@vue/compiler-core/src/runtimeConstants.ts'
export { withDirectives } from './directives'
export {
  resolveComponent,
  resolveDirective,
  resolveDynamicComponent
} from './helpers/resolveAssets'
export { renderList } from './helpers/renderList'
export { toString } from './helpers/toString'
export { toHandlers } from './helpers/toHandlers'
export { renderSlot } from './helpers/renderSlot'
export { createSlots } from './helpers/createSlots'
export { setBlockTracking, createTextVNode, createCommentVNode } from './vnode'
// Since @vue/shared is inlined into final builds,
// when re-exporting from @vue/shared we need to avoid relying on their original
// types so that the bundled d.ts does not attempt to import from it.
import { capitalize as _capitalize, camelize as _camelize } from '@vue/shared'
export const capitalize = _capitalize as (s: string) => string
export const camelize = _camelize as (s: string) => string

// Internal, for integration with runtime compiler
export { registerRuntimeCompiler } from './component'

// Types -----------------------------------------------------------------------

export { App, AppConfig, AppContext, Plugin } from './apiApp'
export { VNode, VNodeTypes, VNodeProps } from './vnode'
export {
  Component,
  FunctionalComponent,
  ComponentInternalInstance,
  RenderFunction
} from './component'
export {
  ComponentOptions,
  ComponentOptionsWithoutProps,
  ComponentOptionsWithObjectProps as ComponentOptionsWithProps,
  ComponentOptionsWithArrayProps
} from './apiOptions'

export { ComponentPublicInstance } from './componentProxy'
export { RendererOptions } from './createRenderer'
export { Slot, Slots } from './componentSlots'
export {
  Prop,
  PropType,
  ComponentPropsOptions,
  ComponentObjectPropsOptions
} from './componentProps'
export {
  Directive,
  DirectiveBinding,
  DirectiveHook,
  ObjectDirective,
  FunctionDirective,
  DirectiveArguments
} from './directives'
export { SuspenseBoundary } from './suspense'

export const version = __VERSION__
