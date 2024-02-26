// Core API ------------------------------------------------------------------

export const version = __VERSION__
export {
  // core
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
  getCurrentEffect,
  onEffectCleanup,
  // effect scope
  effectScope,
  EffectScope,
  getCurrentScope,
  onScopeDispose,
} from '@vue/reactivity'

export { nextTick } from './scheduler'
export {
  getCurrentInstance,
  type ComponentInternalInstance,
  type Component,
  type ObjectComponent,
  type FunctionalComponent,
  type SetupFn,
} from './component'
export { render, unmountComponent } from './render'
export { renderEffect, renderWatch } from './renderWatch'
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
  resolveDirective,
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
export { on, delegate, delegateEvents } from './dom/event'
export { setRef } from './dom/templateRef'

export { defineComponent } from './apiDefineComponent'
export {
  onBeforeMount,
  onMounted,
  onBeforeUpdate,
  onUpdated,
  onBeforeUnmount,
  onUnmounted,
  // onActivated,
  // onDeactivated,
  // onRenderTracked,
  // onRenderTriggered,
  onErrorCaptured,
  // onServerPrefetch,
} from './apiLifecycle'
export { createIf } from './if'
export { createFor } from './for'

// **Internal** DOM-only runtime directive helpers
export {
  vModelText,
  vModelCheckbox,
  vModelRadio,
  vModelSelect,
  vModelDynamic,
} from './directives/vModel'
export { vShow } from './directives/vShow'
