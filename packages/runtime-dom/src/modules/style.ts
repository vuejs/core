import { isString } from '@vue/shared'

export function patchStyle(el: any, prev: any, next: any) {
  const { style } = el

  if (!next) {
    el.removeAttribute('style')
    return
  }

  if (isString(next)) {
    style.cssText = next
    return
  }

  Object.assign(style, next)

  if (!prev || isString(prev)) {
    return
  }
  
  for (const key in prev) {
    if (!next[key]) {
      style[key] = ''
    }
  }
}
