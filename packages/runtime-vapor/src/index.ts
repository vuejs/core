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
export { withModifiers, withKeys } from '@vue/runtime-dom'

export * from './on'
export * from './render'
export * from './renderWatch'
export * from './template'
export * from './scheduler'
export * from './apiWatch'
export * from './directive'
export * from './dom'
export * from './directives/vShow'
export * from './apiLifecycle'
export { getCurrentInstance, type ComponentInternalInstance } from './component'
