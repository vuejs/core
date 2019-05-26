import { isString } from '@vue/shared'

export function patchStyle(el: any, prev: any, next: any) {
  const { style } = el
  if (!next) {
    el.removeAttribute('style')
  } else if (isString(next)) {
    style.cssText = next
  } else {
    for (const key in next) {
      style[key] = next[key]
    }
    if (prev && !isString(prev)) {
      for (const key in prev) {
        if (!next[key]) {
          style[key] = ''
        }
      }
    }
  }
}
