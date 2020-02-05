import { looseEqual as _looseEqual, looseIndexOf } from '@vue/shared'
import { renderAttr } from './renderAttrs'

export const looseEqual = _looseEqual as (a: unknown, b: unknown) => boolean

export function looseContain(arr: unknown[], value: unknown): boolean {
  return looseIndexOf(arr, value) > -1
}

// for <input :type="type" v-model="model" value="value">
export function renderDynamicModel(
  type: unknown,
  model: unknown,
  value: unknown
) {
  switch (type) {
    case 'radio':
      return _looseEqual(model, value) ? ' checked' : ''
    case 'checkbox':
      return (Array.isArray(model)
      ? looseContain(model, value)
      : model)
        ? ' checked'
        : ''
    default:
      // text types
      return renderAttr('value', model)
  }
}

// for <input v-bind="obj" v-model="model">
export function getDynamicModelProps(existingProps: any = {}, model: unknown) {
  const { type, value } = existingProps
  switch (type) {
    case 'radio':
      return _looseEqual(model, value) ? { checked: true } : null
    case 'checkbox':
      return (Array.isArray(model)
      ? looseContain(model, value)
      : model)
        ? { checked: true }
        : null
    default:
      // text types
      return { value: model }
  }
}
