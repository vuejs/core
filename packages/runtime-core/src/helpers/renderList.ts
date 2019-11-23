import { VNodeChild } from '../vnode'
import { isArray, isString, isObject } from '@vue/shared'

export function renderList(
  source: unknown,
  renderItem: (
    value: unknown,
    key: string | number,
    index?: number
  ) => VNodeChild
): VNodeChild[] {
  let ret: VNodeChild[] = []
  if (isArray(source) || isString(source)) {
    for (let i = 0, l = source.length; i < l; i++) {
      ret[i] = renderItem(source[i], i)
    }
  } else if (typeof source === 'number') {
    for (let i = 0; i < source; i++) {
      ret[i] = renderItem(i + 1, i)
    }
  } else if (isObject(source)) {
    if (source[Symbol.iterator as any]) {
      ret = Array.from(source as Iterable<any>, renderItem)
    } else {
      const keys = Object.keys(source)
      for (let i = 0, l = keys.length; i < l; i++) {
        const key = keys[i]
        ret[i] = renderItem(source[key], key, i)
      }
    }
  }
  return ret!
}
