// Public API ------------------------------------------------------------------

export const version = __VERSION__
export * from './apiReactivity'
export * from './apiWatch'
export * from './apiLifecycle'
export * from './apiInject'
export { nextTick } from './scheduler'
export { defineComponent } from './apiDefineComponent'

// Advanced API ----------------------------------------------------------------

// For getting a hold of the internal instance in setup() - useful for advanced
// plugins
export { getCurrentInstance } from './component'

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
export { Text, Comment, Fragment, Portal } from './vnode'
// Internal Components
export { Suspense, SuspenseProps } from './components/Suspense'
export { KeepAlive, KeepAliveProps } from './components/KeepAlive'
export {
  BaseTransition,
  BaseTransitionProps
} from './components/BaseTransition'
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
  STABLE_FRAGMENT: number
  KEYED_FRAGMENT: number
  UNKEYED_FRAGMENT: number
  DYNAMIC_SLOTS: number
  BAIL: number
}

// SFC CSS Modules
export { useCSSModule } from './helpers/useCssModule'

// For custom renderers
export { createRenderer, RootRenderFunction } from './renderer'
export { warn } from './warning'
export {
  handleError,
  callWithErrorHandling,
  callWithAsyncErrorHandling
} from './errorHandling'
export {
  useTransitionState,
  TransitionState,
  resolveTransitionHooks,
  setTransitionHooks,
  TransitionHooks
} from './components/BaseTransition'

// Internal API ----------------------------------------------------------------

// For compiler generated code
// should sync with '@vue/compiler-core/src/runtimeConstants.ts'
export { withDirectives } from './directives'
export {
  resolveComponent,
  resolveDirective,
  resolveDynamicComponent
} from './helpers/resolveAssets'
export { renderList } from './helpers/renderList'
export { toHandlers } from './helpers/toHandlers'
export { renderSlot } from './helpers/renderSlot'
export { createSlots } from './helpers/createSlots'
export { pushScopeId, popScopeId, withScopeId } from './helpers/scopeId'
export { setBlockTracking, createTextVNode, createCommentVNode } from './vnode'
// Since @vue/shared is inlined into final builds,
// when re-exporting from @vue/shared we need to avoid relying on their original
// types so that the bundled d.ts does not attempt to import from it.
import {
  toDisplayString as _toDisplayString,
  camelize as _camelize
} from '@vue/shared'
export const toDisplayString = _toDisplayString as (s: unknown) => string
export const camelize = _camelize as (s: string) => string

// For integration with runtime compiler
export { registerRuntimeCompiler } from './component'

// SSR -------------------------------------------------------------------------
import { createComponentInstance, setupComponent } from './component'
import {
  renderComponentRoot,
  setCurrentRenderingInstance
} from './componentRenderUtils'
import { isVNode, normalizeVNode } from './vnode'

// SSR utils are only exposed in cjs builds.
const _ssrUtils = {
  createComponentInstance,
  setupComponent,
  renderComponentRoot,
  setCurrentRenderingInstance,
  isVNode,
  normalizeVNode
}

export const ssrUtils = (__NODE_JS__ ? _ssrUtils : null) as typeof _ssrUtils

// Types -----------------------------------------------------------------------

export {
  App,
  AppConfig,
  AppContext,
  Plugin,
  CreateAppFunction
} from './apiCreateApp'
export {
  VNode,
  VNodeTypes,
  VNodeProps,
  VNodeArrayChildren,
  VNodeNormalizedChildren
} from './vnode'
export {
  Component,
  FunctionalComponent,
  ComponentInternalInstance,
  RenderFunction,
  SetupContext
} from './component'
export {
  ComponentOptions,
  ComponentOptionsWithoutProps,
  ComponentOptionsWithObjectProps as ComponentOptionsWithProps,
  ComponentOptionsWithArrayProps
} from './apiOptions'

export { ComponentPublicInstance } from './componentProxy'
export { RendererOptions } from './renderer'
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
export { SuspenseBoundary } from './components/Suspense'
export { HMRRuntime } from './hmr'
