// Public API ------------------------------------------------------------------

export const version = __VERSION__
export {
  effect,
  ref,
  unref,
  shallowRef,
  isRef,
  toRefs,
  reactive,
  isReactive,
  readonly,
  isReadonly,
  shallowReactive,
  toRaw,
  markReadonly,
  markNonReactive
} from '@vue/reactivity'
export { computed } from './apiComputed'
export { watch, watchEffect } from './apiWatch'
export {
  onBeforeMount,
  onMounted,
  onBeforeUpdate,
  onUpdated,
  onBeforeUnmount,
  onUnmounted,
  onActivated,
  onDeactivated,
  onRenderTracked,
  onRenderTriggered,
  onErrorCaptured
} from './apiLifecycle'
export { provide, inject } from './apiInject'
export { nextTick } from './scheduler'
export { defineComponent } from './apiDefineComponent'
export { defineAsyncComponent } from './apiAsyncComponent'

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
// Internal Components
export { Text, Comment, Fragment } from './vnode'
export { Teleport, TeleportProps } from './components/Teleport'
export { Suspense, SuspenseProps } from './components/Suspense'
export { KeepAlive, KeepAliveProps } from './components/KeepAlive'
export {
  BaseTransition,
  BaseTransitionProps
} from './components/BaseTransition'

// SFC CSS Modules
export { useCSSModule } from './helpers/useCssModule'

// SSR context
export { useSSRContext, ssrContextKey } from './helpers/useSsrContext'

// Internal API ----------------------------------------------------------------

// For custom renderers
export { createRenderer, createHydrationRenderer } from './renderer'
export { warn } from './warning'
export {
  handleError,
  callWithErrorHandling,
  callWithAsyncErrorHandling,
  ErrorCodes
} from './errorHandling'
export {
  useTransitionState,
  resolveTransitionHooks,
  setTransitionHooks
} from './components/BaseTransition'

// For compiler generated code
// should sync with '@vue/compiler-core/src/runtimeConstants.ts'
export { withCtx } from './helpers/withRenderContext'
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
export {
  setBlockTracking,
  createTextVNode,
  createCommentVNode,
  createStaticVNode
} from './vnode'
export { toDisplayString, camelize } from '@vue/shared'

// For integration with runtime compiler
export { registerRuntimeCompiler } from './component'

// For test-utils
export { transformVNodeArgs } from './vnode'

// SSR -------------------------------------------------------------------------

import { createComponentInstance, setupComponent } from './component'
import {
  renderComponentRoot,
  setCurrentRenderingInstance
} from './componentRenderUtils'
import { isVNode, normalizeVNode } from './vnode'
import { normalizeSuspenseChildren } from './components/Suspense'

// SSR utils are only exposed in cjs builds.
const _ssrUtils = {
  createComponentInstance,
  setupComponent,
  renderComponentRoot,
  setCurrentRenderingInstance,
  isVNode,
  normalizeVNode,
  normalizeSuspenseChildren
}

export const ssrUtils = (__NODE_JS__ ? _ssrUtils : null) as typeof _ssrUtils

// Types -----------------------------------------------------------------------

export {
  ReactiveEffect,
  ReactiveEffectOptions,
  DebuggerEvent,
  TrackOpTypes,
  TriggerOpTypes,
  Ref,
  ComputedRef,
  UnwrapRef,
  WritableComputedOptions
} from '@vue/reactivity'
export {
  // types
  WatchEffect,
  BaseWatchOptions,
  WatchOptions,
  WatchCallback,
  WatchSource,
  StopHandle
} from './apiWatch'
export { InjectionKey } from './apiInject'
export {
  App,
  AppConfig,
  AppContext,
  Plugin,
  CreateAppFunction,
  OptionMergeFunction
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
} from './componentOptions'
export { ComponentPublicInstance } from './componentProxy'
export {
  Renderer,
  RendererNode,
  RendererElement,
  HydrationRenderer,
  RendererOptions,
  RootRenderFunction
} from './renderer'
export { RootHydrateFunction } from './hydration'
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
export { TransitionState, TransitionHooks } from './components/BaseTransition'
export {
  AsyncComponentOptions,
  AsyncComponentLoader
} from './apiAsyncComponent'
export { HMRRuntime } from './hmr'
