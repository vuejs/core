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
  onScopeDispose
} from '@vue/reactivity'
export * from './on'
export * from './render'
export * from './template'
export * from './scheduler'
