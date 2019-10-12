import { registerRuntimeHelpers } from '@vue/compiler-core'

export const V_MODEL_RADIO = Symbol(__DEV__ ? `vModelRadio` : ``)
export const V_MODEL_CHECKBOX = Symbol(__DEV__ ? `vModelCheckbox` : ``)
export const V_MODEL_TEXT = Symbol(__DEV__ ? `vModelText` : ``)
export const V_MODEL_SELECT = Symbol(__DEV__ ? `vModelSelect` : ``)
export const V_MODEL_DYNAMIC = Symbol(__DEV__ ? `vModelDynamic` : ``)

registerRuntimeHelpers({
  [V_MODEL_RADIO]: `vModelRadio`,
  [V_MODEL_CHECKBOX]: `vModelCheckbox`,
  [V_MODEL_TEXT]: `vModelText`,
  [V_MODEL_SELECT]: `vModelSelect`,
  [V_MODEL_DYNAMIC]: `vModelDynamic`
})
