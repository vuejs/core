import { isObservable } from '@vue/core'

// style properties that should NOT have "px" added when numeric
const nonNumericRE = /acit|ex(?:s|g|n|p|$)|rph|ows|mnc|ntw|ine[ch]|zoo|^ord/i

export function patchStyle(el: any, prev: any, next: any, data: any) {
  // If next is observed, the user is likely to mutate the style object.
  // We need to normalize + clone it and replace data.style with the clone.
  if (isObservable(next)) {
    data.style = normalizeStyle(next)
  }

  const { style } = el
  if (!next) {
    el.removeAttribute('style')
  } else if (typeof next === 'string') {
    style.cssText = next
  } else {
    // TODO: warn invalid value in dev
    next = normalizeStyle(next)
    for (const key in next) {
      let value = next[key]
      if (typeof value === 'number' && !nonNumericRE.test(key)) {
        value = value + 'px'
      }
      style.setProperty(key, value)
    }
    if (prev && typeof prev !== 'string') {
      prev = normalizeStyle(prev)
      for (const key in prev) {
        if (!next[key]) {
          style.setProperty(key, '')
        }
      }
    }
  }
}

function normalizeStyle(value: any): Record<string, string | number> | void {
  if (value && typeof value === 'object') {
    return value
  } else if (Array.isArray(value)) {
    const res: Record<string, string | number> = {}
    for (let i = 0; i < value.length; i++) {
      const normalized = normalizeStyle(value[i])
      if (normalized) {
        for (const key in normalized) {
          res[key] = normalized[key]
        }
      }
    }
    return res
  }
}
