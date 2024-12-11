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
import {
  mergeProps,
  patchStyle as setStyle,
  shouldSetAsProp,
  warn,
} from '@vue/runtime-dom'

type TargetElement = Element & {
  $html?: string
  $cls?: string
  $clsi?: string
  $sty?: NormalizedStyle
  $styi?: NormalizedStyle
  $dprops?: Record<string, any>
}

export function setText(el: Node & { $txt?: string }, ...values: any[]): void {
  const value = values.map(v => toDisplayString(v)).join('')
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
export function setClassIncremental(el: TargetElement, value: any): void {
  const prev = el.$clsi
  if ((value = normalizeClass(value)) !== prev) {
    el.$clsi = value
    const nextList = value.split(/\s+/)
    el.classList.add(...nextList)
    if (prev) {
      for (const cls of prev.split(/\s+/)) {
        if (!nextList.includes(cls)) el.classList.remove(cls)
      }
    }
  }
}

/**
 * Reuse from runtime-dom
 */
export { setStyle }

/**
 * A version of setStyle that does not overwrite pre-existing styles.
 * Used on single root elements so it can patch class independent of fallthrough
 * attributes.
 */
export function setStyleIncremental(el: TargetElement, value: any): void {
  const prev = el.$styi
  value = el.$styi = isString(value)
    ? parseStringStyle(value)
    : ((normalizeStyle(value) || {}) as NormalizedStyle)
  setStyle(el, prev, value)
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
  el: TargetElement,
  args: any[],
  root = false,
): void {
  const props = args.length > 1 ? mergeProps(...args) : args[0]
  const oldProps = el.$dprops

  if (oldProps) {
    for (const key in oldProps) {
      // TODO should these keys be allowed as dynamic keys? The current logic of the runtime-core will throw an error
      if (key === 'textContent' || key === 'innerHTML') {
        continue
      }

      const oldValue = oldProps[key]
      const hasNewValue = props[key] || props['.' + key] || props['^' + key]
      if (oldValue && !hasNewValue) {
        setDynamicProp(el, key, oldValue, null, root)
      }
    }
  }

  const prev = (el.$dprops = Object.create(null))
  for (const key in props) {
    setDynamicProp(
      el,
      key,
      oldProps ? oldProps[key] : undefined,
      (prev[key] = props[key]),
      root,
    )
  }
}

/**
 * @internal
 */
export function setDynamicProp(
  el: TargetElement,
  key: string,
  prev: any,
  value: any,
  root?: boolean,
): void {
  // TODO
  const isSVG = false
  if (key === 'class') {
    if (root) {
      setClassIncremental(el, value)
    } else {
      setClass(el, value)
    }
  } else if (key === 'style') {
    if (root) {
      setStyleIncremental(el, value)
    } else {
      setStyle(el, prev, value)
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
}
