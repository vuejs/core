import { isString } from '@vue/shared'

// style properties that should NOT have "px" added when numeric
const nonNumericRE = /acit|ex(?:s|g|n|p|$)|rph|ows|mnc|ntw|ine[ch]|zoo|^ord/i

export function patchStyle(el: any, prev: any, next: any, data: any) {
  const { style } = el
  if (!next) {
    el.removeAttribute('style')
  } else if (isString(next)) {
    style.cssText = next
  } else {
    for (const key in next) {
      let value = next[key]
      if (typeof value === 'number' && !nonNumericRE.test(key)) {
        value = value + 'px'
      }
      style[key] = value
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
