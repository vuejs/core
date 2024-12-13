import {
  type NormalizedStyle,
  canSetValueDirectly,
  isOn,
  isString,
  normalizeClass,
  normalizeStyle,
  parseStringStyle,
  toDisplayString,
} from '@vue/shared'
import { on } from './event'
import { mergeProps, patchStyle, shouldSetAsProp, warn } from '@vue/runtime-dom'

type TargetElement = Element & {
  $html?: string
  $cls?: string
  $sty?: NormalizedStyle | string | undefined
}

export function setText(el: Node & { $txt?: string }, ...values: any[]): void {
  const value =
    values.length > 1
      ? values.map(toDisplayString).join('')
      : toDisplayString(values[0])
  if (el.$txt !== value) {
    el.textContent = el.$txt = value
  }
}

export function setHtml(el: TargetElement, value: any): void {
  value = value == null ? '' : value
  if (el.$html !== value) {
    el.innerHTML = el.$html = value
  }
}

export function setClass(el: TargetElement, value: any): void {
  if ((value = normalizeClass(value)) !== el.$cls) {
    el.className = el.$cls = value
  }
}

/**
 * A version of setClass that does not overwrite pre-existing classes.
 * Used on single root elements so it can patch class independent of fallthrough
 * attributes.
 */
export function setClassIncremental(
  el: any,
  value: any,
  fallthrough?: boolean,
): void {
  const cacheKey = `$clsi${fallthrough ? '$' : ''}`
  const prev = el[cacheKey]
  if ((value = el[cacheKey] = normalizeClass(value)) !== prev) {
    const nextList = value.split(/\s+/)
    el.classList.add(...nextList)
    if (prev) {
      for (const cls of prev.split(/\s+/)) {
        if (!nextList.includes(cls)) el.classList.remove(cls)
      }
    }
  }
}

export function setStyle(el: TargetElement, value: any): void {
  const prev = el.$sty
  value = el.$sty = normalizeStyle(value)
  patchStyle(el, prev, value)
}

/**
 * A version of setStyle that does not overwrite pre-existing styles.
 * Used on single root elements so it can patch class independent of fallthrough
 * attributes.
 */
export function setStyleIncremental(
  el: any,
  value: any,
  fallthrough?: boolean,
): NormalizedStyle | undefined {
  const cacheKey = `$styi${fallthrough ? '$' : ''}`
  const prev = el[cacheKey]
  value = el[cacheKey] = isString(value)
    ? parseStringStyle(value)
    : (normalizeStyle(value) as NormalizedStyle | undefined)
  patchStyle(el, prev, value)
  return value
}

export function setAttr(el: any, key: string, value: any): void {
  if (value !== el[`$${key}`]) {
    el[`$${key}`] = value
    if (value != null) {
      el.setAttribute(key, value)
    } else {
      el.removeAttribute(key)
    }
  }
}

export function setValue(
  el: Element & { value?: string; _value?: any },
  value: any,
): void {
  // store value as _value as well since
  // non-string values will be stringified.
  el._value = value
  // #4956: <option> value will fallback to its text content so we need to
  // compare against its attribute value instead.
  const oldValue = el.tagName === 'OPTION' ? el.getAttribute('value') : el.value
  const newValue = value == null ? '' : value
  if (oldValue !== newValue) {
    el.value = newValue
  }
  if (value == null) {
    el.removeAttribute('value')
  }
}

export function setProp(el: any, key: string, value: any): void {
  if (key in el) {
    setDOMProp(el, key, value)
  } else {
    setAttr(el, key, value)
  }
}

export function setDOMProp(el: any, key: string, value: any): void {
  const prev = el[key]
  if (value === prev) {
    return
  }

  let needRemove = false
  if (value === '' || value == null) {
    const type = typeof prev
    if (value == null && type === 'string') {
      // e.g. <div :id="null">
      value = ''
      needRemove = true
    } else if (type === 'number') {
      // e.g. <img :width="null">
      value = 0
      needRemove = true
    }
  }

  // some properties perform value validation and throw,
  // some properties has getter, no setter, will error in 'use strict'
  // eg. <select :type="null"></select> <select :willValidate="null"></select>
  try {
    el[key] = value
  } catch (e: any) {
    // do not warn if value is auto-coerced from nullish values
    if (__DEV__ && !needRemove) {
      warn(
        `Failed setting prop "${key}" on <${el.tagName.toLowerCase()}>: ` +
          `value ${value} is invalid.`,
        e,
      )
    }
  }
  needRemove && el.removeAttribute(key)
}

export function setDynamicProps(
  el: any,
  args: any[],
  root = false,
  fallthrough = false,
): void {
  const props = args.length > 1 ? mergeProps(...args) : args[0]
  const cacheKey = `$dprops${fallthrough ? '$' : ''}`
  const prevKeys = el[cacheKey] as string[]

  if (prevKeys) {
    for (const key of prevKeys) {
      if (!(key in props)) {
        setDynamicProp(el, key, null, root, fallthrough)
      }
    }
  }

  for (const key of (el[cacheKey] = Object.keys(props))) {
    setDynamicProp(el, key, props[key], root, fallthrough)
  }
}

/**
 * @internal
 */
export function setDynamicProp(
  el: TargetElement,
  key: string,
  value: any,
  root?: boolean,
  fallthrough?: boolean,
): any {
  // TODO
  const isSVG = false
  if (key === 'class') {
    if (root) {
      return setClassIncremental(el, value, fallthrough)
    } else {
      setClass(el, value)
    }
  } else if (key === 'style') {
    if (root) {
      return setStyleIncremental(el, value, fallthrough)
    } else {
      setStyle(el, value)
    }
  } else if (isOn(key)) {
    on(el, key[2].toLowerCase() + key.slice(3), () => value, { effect: true })
  } else if (
    key[0] === '.'
      ? ((key = key.slice(1)), true)
      : key[0] === '^'
        ? ((key = key.slice(1)), false)
        : shouldSetAsProp(el, key, value, isSVG)
  ) {
    if (key === 'innerHTML') {
      setHtml(el, value)
    } else if (key === 'textContent') {
      setText(el, value)
    } else if (key === 'value' && canSetValueDirectly(el.tagName)) {
      setValue(el, value)
    } else {
      setDOMProp(el, key, value)
    }
  } else {
    // TODO special case for <input v-model type="checkbox">
    setAttr(el, key, value)
  }
  return value
}
