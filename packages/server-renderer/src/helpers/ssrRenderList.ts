import { isArray, isObject, isString } from '@vue/shared'
import { warn } from '@vue/runtime-dom'

export function ssrRenderList(
  source: unknown,
  renderItem: (value: unknown, key: string | number, index?: number) => void,
): void {
  if (isArray(source) || isString(source)) {
    for (let i = 0, l = source.length; i < l; i++) {
      renderItem(source[i], i)
    }
  } else if (typeof source === 'number') {
    if (!Number.isInteger(source) || source < 0) {
      if (__DEV__) {
        warn(
          `The v-for range expects a positive integer value but got ${source}.`,
        )
      }
      return
    }
    for (let i = 0; i < source; i++) {
      renderItem(i + 1, i)
    }
  } else if (isObject(source)) {
    if (source[Symbol.iterator as any]) {
      let i = 0
      for (const item of source as Iterable<any>) {
        renderItem(item, i++)
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
