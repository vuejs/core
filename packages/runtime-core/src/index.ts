// Core API ------------------------------------------------------------------

export const version = __VERSION__
export {
  // core
  reactive,
  ref,
  readonly,
  // utilities
  unref,
  proxyRefs,
  isRef,
  toRef,
  toValue,
  toRefs,
  isProxy,
  isReactive,
  isReadonly,
  isShallow,
  // advanced
  customRef,
  triggerRef,
  shallowRef,
  shallowReactive,
  shallowReadonly,
  markRaw,
  toRaw,
  // effect
  effect,
  stop,
  ReactiveEffect,
  // effect scope
  effectScope,
  EffectScope,
  getCurrentScope,
  onScopeDispose,
} from '@vue/reactivity'
export { computed } from './apiComputed'
export {
  watch,
  watchEffect,
  watchPostEffect,
  watchSyncEffect,
} from './apiWatch'
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
  onErrorCaptured,
  onServerPrefetch,
} from './apiLifecycle'
export { provide, inject, hasInjectionContext } from './apiInject'
export { nextTick } from './scheduler'
export { defineComponent } from './apiDefineComponent'
export { defineAsyncComponent } from './apiAsyncComponent'
export { useAttrs, useSlots } from './apiSetupHelpers'
export { useModel } from './helpers/useModel'

// <script setup> API ----------------------------------------------------------

export {
  // macros runtime, for typing and warnings only
  defineProps,
  defineEmits,
  defineExpose,
  defineOptions,
  defineSlots,
  defineModel,
  withDefaults,
  type DefineProps,
  type ModelRef,
} from './apiSetupHelpers'

/**
 * @internal
 */
export {
  mergeDefaults,
  mergeModels,
  createPropsRestProxy,
  withAsyncContext,
} from './apiSetupHelpers'

// Advanced API ----------------------------------------------------------------

// For getting a hold of the internal instance in setup() - useful for advanced
// plugins
export { getCurrentInstance } from './component'

// For raw render function users
export { h } from './h'
// Advanced render function utilities
export { createVNode, cloneVNode, mergeProps, isVNode } from './vnode'
// VNode types
export { Fragment, Text, Comment, Static, type VNodeRef } from './vnode'
// Built-in components
export { Teleport, type TeleportProps } from './components/Teleport'
export { Suspense, type SuspenseProps } from './components/Suspense'
export { KeepAlive, type KeepAliveProps } from './components/KeepAlive'
export {
  BaseTransition,
  BaseTransitionPropsValidators,
  type BaseTransitionProps,
} from './components/BaseTransition'
// For using custom directives
export { withDirectives } from './directives'
// SSR context
export { useSSRContext, ssrContextKey } from './helpers/useSsrContext'

// Custom Renderer API ---------------------------------------------------------

export { createRenderer, createHydrationRenderer } from './renderer'
export { queuePostFlushCb } from './scheduler'
import { warn as _warn } from './warning'
export const warn = (__DEV__ ? _warn : NOOP) as typeof _warn

/** @internal */
export { assertNumber } from './warning'
export {
  handleError,
  callWithErrorHandling,
  callWithAsyncErrorHandling,
  ErrorCodes,
} from './errorHandling'
export {
  resolveComponent,
  resolveDirective,
  resolveDynamicComponent,
} from './helpers/resolveAssets'
// For integration with runtime compiler
export { registerRuntimeCompiler, isRuntimeOnly } from './component'
export {
  useTransitionState,
  resolveTransitionHooks,
  setTransitionHooks,
  getTransitionRawChildren,
} from './components/BaseTransition'
export { initCustomFormatter } from './customFormatter'

import { ErrorTypeStrings as _ErrorTypeStrings } from './errorHandling'
/**
 * Runtime error messages. Only exposed in dev or esm builds.
 * @internal
 */
export const ErrorTypeStrings = (
  __ESM_BUNDLER__ || __CJS__ || __DEV__ ? _ErrorTypeStrings : null
) as typeof _ErrorTypeStrings

// For devtools
import {
  type DevtoolsHook,
  devtools as _devtools,
  setDevtoolsHook as _setDevtoolsHook,
} from './devtools'

export const devtools = (
  __DEV__ || __ESM_BUNDLER__ ? _devtools : undefined
) as DevtoolsHook
export const setDevtoolsHook = (
  __DEV__ || __ESM_BUNDLER__ ? _setDevtoolsHook : NOOP
) as typeof _setDevtoolsHook

// Types -----------------------------------------------------------------------

import type { VNode } from './vnode'
import type { ComponentInternalInstance } from './component'

// Augment Ref unwrap bail types.
declare module '@vue/reactivity' {
  export interface RefUnwrapBailTypes {
    runtimeCoreBailTypes:
      | VNode
      | {
          // directly bailing on ComponentPublicInstance results in recursion
          // so we use this as a bail hint
          $: ComponentInternalInstance
        }
  }
}

export { TrackOpTypes, TriggerOpTypes } from '@vue/reactivity'
export type {
  Ref,
  MaybeRef,
  MaybeRefOrGetter,
  ToRef,
  ToRefs,
  UnwrapRef,
  ShallowRef,
  ShallowUnwrapRef,
  CustomRefFactory,
  ReactiveFlags,
  DeepReadonly,
  ShallowReactive,
  UnwrapNestedRefs,
  ComputedRef,
  WritableComputedRef,
  WritableComputedOptions,
  ComputedGetter,
  ComputedSetter,
  ReactiveEffectRunner,
  ReactiveEffectOptions,
  EffectScheduler,
  DebuggerOptions,
  DebuggerEvent,
  DebuggerEventExtraInfo,
  Raw,
  Reactive,
} from '@vue/reactivity'
export type {
  WatchEffect,
  WatchOptions,
  WatchOptionsBase,
  WatchCallback,
  WatchSource,
  WatchStopHandle,
} from './apiWatch'
export type { InjectionKey } from './apiInject'
export type {
  App,
  AppConfig,
  AppContext,
  Plugin,
  ObjectPlugin,
  FunctionPlugin,
  CreateAppFunction,
  OptionMergeFunction,
} from './apiCreateApp'
export type {
  VNode,
  VNodeChild,
  VNodeTypes,
  VNodeProps,
  VNodeArrayChildren,
  VNodeNormalizedChildren,
} from './vnode'
export type {
  Component,
  ConcreteComponent,
  FunctionalComponent,
  ComponentInternalInstance,
  SetupContext,
  ComponentCustomProps,
  AllowedComponentProps,
  ComponentInstance,
} from './component'
export type {
  DefineComponent,
  DefineSetupFnComponent,
  PublicProps,
} from './apiDefineComponent'
export type {
  ComponentOptions,
  ComponentOptionsMixin,
  ComponentOptionsWithoutProps,
  ComponentOptionsWithObjectProps,
  ComponentOptionsWithArrayProps,
  ComponentCustomOptions,
  ComponentOptionsBase,
  ComponentProvideOptions,
  RenderFunction,
  MethodOptions,
  ComputedOptions,
  RuntimeCompilerOptions,
  ComponentInjectOptions,
} from './componentOptions'
export type { EmitsOptions, ObjectEmitsOptions } from './componentEmits'
export type {
  ComponentPublicInstance,
  ComponentCustomProperties,
  CreateComponentPublicInstance,
} from './componentPublicInstance'
export type {
  Renderer,
  RendererNode,
  RendererElement,
  HydrationRenderer,
  RendererOptions,
  RootRenderFunction,
  ElementNamespace,
} from './renderer'
export type { RootHydrateFunction } from './hydration'
export type { Slot, Slots, SlotsType } from './componentSlots'
export type {
  Prop,
  PropType,
  ComponentPropsOptions,
  ComponentObjectPropsOptions,
  ExtractPropTypes,
  ExtractPublicPropTypes,
  ExtractDefaultPropTypes,
} from './componentProps'
export type {
  Directive,
  DirectiveBinding,
  DirectiveHook,
  ObjectDirective,
  FunctionDirective,
  DirectiveArguments,
} from './directives'
export type { SuspenseBoundary } from './components/Suspense'
export type {
  TransitionState,
  TransitionHooks,
} from './components/BaseTransition'
export type {
  AsyncComponentOptions,
  AsyncComponentLoader,
} from './apiAsyncComponent'
export type { HMRRuntime } from './hmr'

// Internal API ----------------------------------------------------------------

// **IMPORTANT** Internal APIs may change without notice between versions and
// user code should avoid relying on them.

// For compiler generated code
// should sync with '@vue/compiler-core/src/runtimeHelpers.ts'
export {
  withCtx,
  pushScopeId,
  popScopeId,
  withScopeId,
} from './componentRenderContext'
export { renderList } from './helpers/renderList'
export { toHandlers } from './helpers/toHandlers'
export { renderSlot } from './helpers/renderSlot'
export { createSlots } from './helpers/createSlots'
export { withMemo, isMemoSame } from './helpers/withMemo'
export {
  openBlock,
  createBlock,
  setBlockTracking,
  createTextVNode,
  createCommentVNode,
  createStaticVNode,
  createElementVNode,
  createElementBlock,
  guardReactiveProps,
} from './vnode'
export {
  toDisplayString,
  camelize,
  capitalize,
  toHandlerKey,
  normalizeProps,
  normalizeClass,
  normalizeStyle,
} from '@vue/shared'

// For test-utils
export { transformVNodeArgs } from './vnode'

// SSR -------------------------------------------------------------------------

// **IMPORTANT** These APIs are exposed solely for @vue/server-renderer and may
// change without notice between versions. User code should never rely on them.

import {
  createComponentInstance,
  getComponentPublicInstance,
  setupComponent,
} from './component'
import { renderComponentRoot } from './componentRenderUtils'
import { setCurrentRenderingInstance } from './componentRenderContext'
import { isVNode, normalizeVNode } from './vnode'

const _ssrUtils = {
  createComponentInstance,
  setupComponent,
  renderComponentRoot,
  setCurrentRenderingInstance,
  isVNode,
  normalizeVNode,
  getComponentPublicInstance,
}

/**
 * SSR utils for \@vue/server-renderer. Only exposed in ssr-possible builds.
 * @internal
 */
export const ssrUtils = (__SSR__ ? _ssrUtils : null) as typeof _ssrUtils

// 2.x COMPAT ------------------------------------------------------------------

import { DeprecationTypes as _DeprecationTypes } from './compat/compatConfig'
export type { CompatVue } from './compat/global'
export type { LegacyConfig } from './compat/globalConfig'

import { warnDeprecation } from './compat/compatConfig'
import { createCompatVue } from './compat/global'
import {
  checkCompatEnabled,
  isCompatEnabled,
  softAssertCompatEnabled,
} from './compat/compatConfig'
import { resolveFilter as _resolveFilter } from './helpers/resolveAssets'
import { NOOP } from '@vue/shared'

/**
 * @internal only exposed in compat builds
 */
export const resolveFilter = __COMPAT__ ? _resolveFilter : null

const _compatUtils = {
  warnDeprecation,
  createCompatVue,
  isCompatEnabled,
  checkCompatEnabled,
  softAssertCompatEnabled,
}

/**
 * @internal only exposed in compat builds.
 */
export const compatUtils = (
  __COMPAT__ ? _compatUtils : null
) as typeof _compatUtils

export const DeprecationTypes = (
  __COMPAT__ ? _DeprecationTypes : null
) as typeof _DeprecationTypes
