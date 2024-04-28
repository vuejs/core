// Core API ------------------------------------------------------------------

export const version = __VERSION__
export {
  // core
  type Ref,
  reactive,
  ref,
  readonly,
  computed,
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
  stop,
  ReactiveEffect,
  onEffectCleanup,
  // effect scope
  effectScope,
  EffectScope,
  getCurrentScope,
  onScopeDispose,
  // baseWatch
  onWatcherCleanup,
  getCurrentWatcher,
} from '@vue/reactivity'

import { NOOP } from '@vue/shared'
import { warn as _warn } from './warning'
export const warn = (__DEV__ ? _warn : NOOP) as typeof _warn

export { nextTick } from './scheduler'
export {
  getCurrentInstance,
  type ComponentInternalInstance,
  type Component,
  type ObjectComponent,
  type FunctionalComponent,
  type SetupFn,
} from './component'
export { createSlot } from './componentSlots'
export { renderEffect } from './renderEffect'
export {
  watch,
  watchEffect,
  watchPostEffect,
  watchSyncEffect,
  type WatchEffect,
  type WatchOptions,
  type WatchOptionsBase,
  type WatchCallback,
  type WatchSource,
  type WatchStopHandle,
} from './apiWatch'
export {
  withDirectives,
  type Directive,
  type DirectiveBinding,
  type DirectiveHook,
  type ObjectDirective,
  type FunctionDirective,
  type DirectiveArguments,
  type DirectiveModifiers,
} from './directives'

export { template, children, next } from './dom/template'
export { insert, prepend, remove, createTextNode } from './dom/element'
export { setStyle } from './dom/style'
export {
  setText,
  setHtml,
  setClass,
  setAttr,
  setDOMProp,
  setDynamicProp,
  setDynamicProps,
} from './dom/prop'
export { on, delegate, delegateEvents, setDynamicEvents } from './dom/event'
export { setRef } from './dom/templateRef'

export { defineComponent } from './apiDefineComponent'
export {
  type InjectionKey,
  inject,
  provide,
  hasInjectionContext,
} from './apiInject'
export {
  onBeforeMount,
  onMounted,
  onBeforeUpdate,
  onUpdated,
  onBeforeUnmount,
  onUnmounted,
  // onActivated,
  // onDeactivated,
  onRenderTracked,
  onRenderTriggered,
  onErrorCaptured,
  // onServerPrefetch,
} from './apiLifecycle'
export { useAttrs, useSlots } from './apiSetupHelpers'
export {
  createVaporApp,
  type App,
  type AppConfig,
  type AppContext,
} from './apiCreateVaporApp'
export { createIf } from './apiCreateIf'
export { createFor } from './apiCreateFor'
export { createComponent } from './apiCreateComponent'

export { resolveComponent, resolveDirective } from './helpers/resolveAssets'

// **Internal** DOM-only runtime directive helpers
export {
  vModelText,
  vModelCheckbox,
  vModelRadio,
  vModelSelect,
  vModelDynamic,
} from './directives/vModel'
export { vShow } from './directives/vShow'
