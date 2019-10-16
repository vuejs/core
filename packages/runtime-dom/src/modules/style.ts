import { isString } from '@vue/shared'

type Style = string | Partial<CSSStyleDeclaration>

export function patchStyle(el: HTMLElement, prev: Style, next: Style) {
  const { style } = el
  if (!next) {
    el.removeAttribute('style')
  } else if (isString(next)) {
    style.cssText = next
  } else {
    for (const key in next) {
      style[key] = next[key] as string
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
