import { isArray, isString, isObject } from '@vue/shared'
import { warn } from '@vue/runtime-core'

export function ssrRenderList(
  source: unknown,
  renderItem: (value: unknown, key: string | number, index?: number) => void
) {
  if (isArray(source) || isString(source)) {
    for (let i = 0, l = source.length; i < l; i++) {
      renderItem(source[i], i)
    }
  } else if (typeof source === 'number') {
    if (__DEV__ && !Number.isInteger(source)) {
      warn(`The v-for range expect an integer value but got ${source}.`)
      return
    }
    for (let i = 0; i < source; i++) {
      renderItem(i + 1, i)
    }
  } else if (isObject(source)) {
    if (source[Symbol.iterator as any]) {
      const arr = Array.from(source as Iterable<any>)
      for (let i = 0, l = arr.length; i < l; i++) {
        renderItem(arr[i], i)
      }
    } else {
      const keys = Object.keys(source)
      for (let i = 0, l = keys.length; i < l; i++) {
        const key = keys[i]
        renderItem(source[key], key, i)
      }
    }
  }
}
