import { isArray, isSet, looseEqual, looseIndexOf } from '@vue/shared'
import { ssrRenderAttr } from './ssrRenderAttrs'

export const ssrLooseEqual = looseEqual as (a: unknown, b: unknown) => boolean

export function ssrLooseContain(arr: unknown[], value: unknown): boolean {
  return looseIndexOf(arr, value) > -1
}

// for <input :type="type" v-model="model" value="value">
export function ssrRenderDynamicModel(
  type: unknown,
  model: unknown,
  value: unknown,
  trueValue?: unknown,
): string {
  switch (type) {
    case 'radio':
      return looseEqual(model, value) ? ' checked' : ''
    case 'checkbox':
      // Check argument presence to preserve an explicit undefined true-value.
      return (
        isArray(model)
          ? ssrLooseContain(model, value)
          : isSet(model)
            ? model.has(value)
            : arguments.length > 3
              ? looseEqual(model, trueValue)
              : model
      )
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
  model: unknown,
): { checked: boolean } | { value: any } | null {
  const { type, value } = existingProps
  switch (type) {
    case 'radio':
      return looseEqual(model, value) ? { checked: true } : null
    case 'checkbox':
      return {
        checked: isArray(model)
          ? ssrLooseContain(model, value)
          : isSet(model)
            ? model.has(value)
            : 'true-value' in existingProps
              ? looseEqual(model, existingProps['true-value'])
              : !!model,
      }
    default:
      // text types
      return { value: model }
  }
}
