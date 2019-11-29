import { registerRuntimeHelpers } from '@vue/compiler-core'

export const V_MODEL_RADIO = Symbol(__DEV__ ? `vModelRadio` : ``)
export const V_MODEL_CHECKBOX = Symbol(__DEV__ ? `vModelCheckbox` : ``)
export const V_MODEL_TEXT = Symbol(__DEV__ ? `vModelText` : ``)
export const V_MODEL_SELECT = Symbol(__DEV__ ? `vModelSelect` : ``)
export const V_MODEL_DYNAMIC = Symbol(__DEV__ ? `vModelDynamic` : ``)

export const V_ON_WITH_MODIFIERS = Symbol(__DEV__ ? `vOnModifiersGuard` : ``)
export const V_ON_WITH_KEYS = Symbol(__DEV__ ? `vOnKeysGuard` : ``)

export const V_SHOW = Symbol(__DEV__ ? `vShow` : ``)

export const TRANSITION = Symbol(__DEV__ ? `Transition` : ``)
export const TRANSITION_GROUP = Symbol(__DEV__ ? `TransitionGroup` : ``)

registerRuntimeHelpers({
  [V_MODEL_RADIO]: `vModelRadio`,
  [V_MODEL_CHECKBOX]: `vModelCheckbox`,
  [V_MODEL_TEXT]: `vModelText`,
  [V_MODEL_SELECT]: `vModelSelect`,
  [V_MODEL_DYNAMIC]: `vModelDynamic`,
  [V_ON_WITH_MODIFIERS]: `withModifiers`,
  [V_ON_WITH_KEYS]: `withKeys`,
  [V_SHOW]: `vShow`,
  [TRANSITION]: `Transition`,
  [TRANSITION_GROUP]: `TransitionGroup`
})
