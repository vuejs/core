import { capitalize, hyphenate, isArray, isString } from '@vue/shared'
import { camelize, warn } from '@vue/runtime-core'
import {
  type VShowElement,
  vShowHidden,
  vShowOriginalDisplay,
} from '../directives/vShow'
import { CSS_VAR_TEXT } from '../helpers/useCssVars'

type ObjectStyle = Record<string, string | string[]>
type Style = string | ObjectStyle | null

const displayRE = /(?:^|;)\s*display\s*:/
const cacheKey: unique symbol = Symbol('_vsc')

export function patchStyle(
  el: Element & { [cacheKey]?: ObjectStyle },
  prev: Style,
  next: Style,
): void {
  const style = (el as HTMLElement).style
  const isCssString = isString(next)
  let hasControlledDisplay = false
  if (next && !isCssString) {
    const cachedStyle = el[cacheKey]
    const nextCache: ObjectStyle = {}
    if (prev) {
      if (!isString(prev)) {
        // Compare removals against the last applied snapshot so prev === next
        // still clears keys deleted by in-place mutations.
        if (cachedStyle) prev = cachedStyle
        for (const key in prev) {
          if (next[key] == null) {
            setStyle(style, key, '')
          }
        }
      } else {
        for (const prevStyle of prev.split(';')) {
          const key = prevStyle.slice(0, prevStyle.indexOf(':')).trim()
          if (next[key] == null) {
            setStyle(style, key, '')
          }
        }
      }
    }
    for (const key in next) {
      if (key === 'display') {
        hasControlledDisplay = true
      }
      const value = next[key]
      if (value != null) {
        // Nullish values are cleared by the removal pass above, or are a
        // no-op on the first object patch when nothing has been applied yet.
        nextCache[key] = isArray(value) ? value.slice() : value
        if (
          !shouldPreserveTextareaResizeStyle(
            el,
            key,
            cachedStyle && cachedStyle[key],
            value,
          )
        ) {
          setStyle(style, key, value)
        }
      }
    }
    el[cacheKey] = nextCache
  } else {
    el[cacheKey] = undefined
    if (isCssString) {
      if (prev !== next) {
        // #9821
        const cssVarText = (style as any)[CSS_VAR_TEXT]
        if (cssVarText) {
          ;(next as string) += ';' + cssVarText
        }
        style.cssText = next as string
        hasControlledDisplay = displayRE.test(next)
      }
    } else if (prev) {
      el.removeAttribute('style')
    }
  }
  // indicates the element also has `v-show`.
  if (vShowOriginalDisplay in el) {
    // make v-show respect the current v-bind style display when shown
    el[vShowOriginalDisplay] = hasControlledDisplay ? style.display : ''
    // if v-show is in hidden state, v-show has higher priority
    if ((el as VShowElement)[vShowHidden]) {
      style.display = 'none'
    }
  }
}

const semicolonRE = /[^\\];\s*$/
const importantRE = /\s*!important$/

function setStyle(
  style: CSSStyleDeclaration,
  name: string,
  val: string | string[],
) {
  if (isArray(val)) {
    val.forEach(v => setStyle(style, name, v))
  } else {
    if (val == null) val = ''
    if (__DEV__) {
      if (semicolonRE.test(val)) {
        warn(
          `Unexpected semicolon at the end of '${name}' style value: '${val}'`,
        )
      }
    }
    if (name.startsWith('--')) {
      // custom property definition
      style.setProperty(name, val)
    } else {
      const prefixed = autoPrefix(style, name)
      if (importantRE.test(val)) {
        // !important
        style.setProperty(
          hyphenate(prefixed),
          val.replace(importantRE, ''),
          'important',
        )
      } else {
        style[prefixed as any] = val
      }
    }
  }
}

const prefixes = ['Webkit', 'Moz', 'ms']
const prefixCache: Record<string, string> = {}

function autoPrefix(style: CSSStyleDeclaration, rawName: string): string {
  const cached = prefixCache[rawName]
  if (cached) {
    return cached
  }
  let name = camelize(rawName)
  if (name !== 'filter' && name in style) {
    return (prefixCache[rawName] = name)
  }
  name = capitalize(name)
  for (let i = 0; i < prefixes.length; i++) {
    const prefixed = prefixes[i] + name
    if (prefixed in style) {
      return (prefixCache[rawName] = prefixed)
    }
  }
  return rawName
}

function styleValueEqual(
  prev: string | string[] | undefined,
  next: string | string[],
): boolean {
  if (isArray(prev) && isArray(next)) {
    if (prev.length !== next.length) {
      return false
    }
    for (let i = 0; i < prev.length; i++) {
      if (prev[i] !== next[i]) {
        return false
      }
    }
    return true
  }
  return prev === next
}

/**
 * Keep vnode style authoritative except for unchanged textarea width/height.
 * This avoids resize flicker and also preserves manual DOM mutations for those
 * two keys; other unchanged keys still reapply vnode state.
 */
function shouldPreserveTextareaResizeStyle(
  el: Element,
  key: string,
  prev: string | string[] | undefined,
  next: string | string[],
): boolean {
  return (
    el.tagName === 'TEXTAREA' &&
    (key === 'width' || key === 'height') &&
    styleValueEqual(prev, next)
  )
}
