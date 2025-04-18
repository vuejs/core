import {
  escapeHtml,
  isRenderableAttrValue,
  isSVGTag,
  stringifyStyle,
} from '@vue/shared'
import {
  includeBooleanAttr,
  isBooleanAttr,
  isOn,
  isSSRSafeAttrName,
  isString,
  makeMap,
  normalizeClass,
  normalizeStyle,
  propsToAttrMap,
} from '@vue/shared'

// leading comma for empty string ""
const shouldIgnoreProp = /*@__PURE__*/ makeMap(
  `,key,ref,innerHTML,textContent,ref_key,ref_for`,
)

export function ssrRenderAttrs(
  props: Record<string, unknown>,
  tag?: string,
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
      ret += ` class="${ssrRenderClass(value)}"`
    } else if (key === 'style') {
      ret += ` style="${ssrRenderStyle(value)}"`
    } else if (key === 'className') {
      ret += ` class="${String(value)}"`
    } else {
      ret += ssrRenderDynamicAttr(key, value, tag)
    }
  }
  return ret
}

// render an attr with dynamic (unknown) key.
export function ssrRenderDynamicAttr(
  key: string,
  value: unknown,
  tag?: string,
): string {
  if (!isRenderableAttrValue(value)) {
    return ``
  }
  const attrKey =
    tag && (tag.indexOf('-') > 0 || isSVGTag(tag))
      ? key // preserve raw name on custom elements and svg
      : propsToAttrMap[key] || key.toLowerCase()
  if (isBooleanAttr(attrKey)) {
    return includeBooleanAttr(value) ? ` ${attrKey}` : ``
  } else if (isSSRSafeAttrName(attrKey)) {
    return value === '' ? ` ${attrKey}` : ` ${attrKey}="${escapeHtml(value)}"`
  } else {
    console.warn(
      `[@vue/server-renderer] Skipped rendering unsafe attribute name: ${attrKey}`,
    )
    return ``
  }
}

// Render a v-bind attr with static key. The key is pre-processed at compile
// time and we only need to check and escape value.
export function ssrRenderAttr(key: string, value: unknown): string {
  if (!isRenderableAttrValue(value)) {
    return ``
  }
  return ` ${key}="${escapeHtml(value)}"`
}

export function ssrRenderClass(raw: unknown): string {
  return escapeHtml(normalizeClass(raw))
}

export function ssrRenderStyle(raw: unknown): string {
  if (!raw) {
    return ''
  }
  if (isString(raw)) {
    return escapeHtml(raw)
  }
  const styles = normalizeStyle(raw)
  return escapeHtml(stringifyStyle(styles))
}
