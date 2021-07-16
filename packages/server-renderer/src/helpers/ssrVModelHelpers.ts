import { looseEqual, looseIndexOf, isArray } from '@vue/shared'
import { ssrRenderAttr } from './ssrRenderAttrs'

export const ssrLooseEqual = looseEqual as (a: unknown, b: unknown) => boolean

export function ssrLooseContain(arr: unknown[], value: unknown): boolean {
  return looseIndexOf(arr, value) > -1
}

// for <input :type="type" v-model="model" value="value">
export function ssrRenderDynamicModel(
  type: unknown,
  model: unknown,
  value: unknown
) {
  switch (type) {
    case 'radio':
      return looseEqual(model, value) ? ' checked' : ''
    case 'checkbox':
      return (isArray(model)
      ? ssrLooseContain(model, value)
      : model)
        ? ' checked'
        : ''
    default:
      // text types
      return ssrRenderAttr('value', model)
  }
}

// for <input v-bind="obj" v-model="model">
export function ssrGetDynamicModelProps(
  existingProps: any = {},
  model: unknown
) {
  const { type, value } = existingProps
  switch (type) {
    case 'radio':
      return looseEqual(model, value) ? { checked: true } : null
    case 'checkbox':
      return (isArray(model)
      ? ssrLooseContain(model, value)
      : model)
        ? { checked: true }
        : null
    default:
      // text types
      return { value: model }
  }
}
