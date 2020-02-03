import { escapeHtml } from '@vue/shared'
import {
  normalizeClass,
  normalizeStyle,
  propsToAttrMap,
  hyphenate,
  isString,
  isNoUnitNumericStyleProp,
  isOn,
  isSSRSafeAttrName,
  isBooleanAttr,
  makeMap
} from '@vue/shared'

const shouldIgnoreProp = makeMap(`key,ref,innerHTML,textContent`)

export function renderProps(
  props: Record<string, unknown>,
  tag?: string
): string {
  let ret = ''
  for (const key in props) {
    if (
      shouldIgnoreProp(key) ||
      isOn(key) ||
      (tag === 'textarea' && key === 'value')
    ) {
      continue
    }
    const value = props[key]
    if (key === 'class') {
      ret += ` class="${renderClass(value)}"`
    } else if (key === 'style') {
      ret += ` style="${renderStyle(value)}"`
    } else if (value != null) {
      const attrKey =
        tag && tag.indexOf('-') > 0
          ? key // preserve raw name on custom elements
          : propsToAttrMap[key] || key.toLowerCase()
      if (isBooleanAttr(attrKey)) {
        if (value !== false) {
          ret += ` ${attrKey}`
        }
      } else if (isSSRSafeAttrName(attrKey)) {
        ret += ` ${attrKey}="${escapeHtml(value)}"`
      }
    }
  }
  return ret
}

export function renderClass(raw: unknown): string {
  return escapeHtml(normalizeClass(raw))
}

export function renderStyle(raw: unknown): string {
  if (!raw) {
    return ''
  }
  if (isString(raw)) {
    return escapeHtml(raw)
  }
  const styles = normalizeStyle(raw)
  let ret = ''
  for (const key in styles) {
    const value = styles[key]
    const normalizedKey = key.indexOf(`--`) === 0 ? key : hyphenate(key)
    if (
      isString(value) ||
      (typeof value === 'number' && isNoUnitNumericStyleProp(normalizedKey))
    ) {
      // only render valid values
      ret += `${normalizedKey}:${value};`
    }
  }
  return escapeHtml(ret)
}
