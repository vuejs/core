import { isString, hyphenate } from '@vue/shared'

type Style = string | Partial<CSSStyleDeclaration> | null

export function patchStyle(el: Element, prev: Style, next: Style) {
  const style = (el as HTMLElement).style
  if (!next) {
    el.removeAttribute('style')
  } else if (isString(next)) {
    style.cssText = next
  } else {
    for (const key in next) {
      setStyle(style, key, next[key] as string)
    }
    if (prev && !isString(prev)) {
      for (const key in prev) {
        if (!next[key]) {
          setStyle(style, key, '')
        }
      }
    }
  }
}

const importantRE = /\s*!important$/

function setStyle(style: CSSStyleDeclaration, name: string, val: string) {
  let rawName = hyphenate(name)
  if (importantRE.test(val)) {
    style.setProperty(rawName, val.replace(importantRE, ''), 'important')
  } else {
    /**
     * TODO:
     * 1. support values array created by autoprefixer.
     * 2. support css variable, maybe should import 'csstype'.
     *    similar to https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/react/index.d.ts#L1450
     */
    style.setProperty(rawName, val)
  }
}
