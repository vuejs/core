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
export * from './render'
export * from './renderWatch'
export * from './template'
export * from './apiWatch'
export * from './directive'
export * from './dom'
export * from './apiLifecycle'
export * from './if'
export * from './for'
export { defineComponent } from './apiDefineComponent'

export * from './directives/vShow'
export * from './directives/vModel'
