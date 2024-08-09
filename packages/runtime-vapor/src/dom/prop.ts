import {
  includeBooleanAttr,
  isArray,
  isFunction,
  isNativeOn,
  isOn,
  isString,
  normalizeClass,
  normalizeStyle,
  toDisplayString,
} from '@vue/shared'
import { warn } from '../warning'
import { setStyle } from './style'
import {
  MetadataKind,
  getMetadata,
  recordPropMetadata,
} from '../componentMetadata'
import { on } from './event'
import type { Data } from '@vue/runtime-shared'

export function setClass(el: Element, value: any): void {
  const prev = recordPropMetadata(el, 'class', (value = normalizeClass(value)))
  if (value !== prev && (value || prev)) {
    el.className = value
  }
}

export function setAttr(el: Element, key: string, value: any): void {
  const oldVal = recordPropMetadata(el, key, value)
  if (value !== oldVal) {
    if (value != null) {
      el.setAttribute(key, value)
    } else {
      el.removeAttribute(key)
    }
  }
}

export function setDOMProp(el: any, key: string, value: any): void {
  const oldVal = recordPropMetadata(el, key, value)
  if (value === oldVal) return

  if (key === 'innerHTML' || key === 'textContent') {
    // TODO special checks
    // if (prevChildren) {
    //   unmountChildren(prevChildren, parentComponent, parentSuspense)
    // }
    el[key] = value == null ? '' : value
    return
  }

  const tag = el.tagName

  if (
    key === 'value' &&
    tag !== 'PROGRESS' &&
    // custom elements may use _value internally
    !tag.includes('-')
  ) {
    // store value as _value as well since
    // non-string values will be stringified.
    el._value = value
    // #4956: <option> value will fallback to its text content so we need to
    // compare against its attribute value instead.
    const oldValue = tag === 'OPTION' ? el.getAttribute('value') : el.value
    const newValue = value == null ? '' : value
    if (oldValue !== newValue) {
      el.value = newValue
    }
    if (value == null) {
      el.removeAttribute(key)
    }
    return
  }

  let needRemove = false
  if (value === '' || value == null) {
    const type = typeof el[key]
    if (type === 'boolean') {
      // e.g. <select multiple> compiles to { multiple: '' }
      value = includeBooleanAttr(value)
    } else if (value == null && type === 'string') {
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
        `Failed setting prop "${key}" on <${tag.toLowerCase()}>: ` +
          `value ${value} is invalid.`,
        e,
      )
    }
  }
  needRemove && el.removeAttribute(key)
}

export function setDynamicProp(el: Element, key: string, value: any): void {
  // TODO
  const isSVG = false
  if (key === 'class') {
    setClass(el, value)
  } else if (key === 'style') {
    setStyle(el as HTMLElement, value)
  } else if (isOn(key)) {
    on(el, key[2].toLowerCase() + key.slice(3), () => value, { effect: true })
  } else if (
    key[0] === '.'
      ? ((key = key.slice(1)), true)
      : key[0] === '^'
        ? ((key = key.slice(1)), false)
        : shouldSetAsProp(el, key, value, isSVG)
  ) {
    setDOMProp(el, key, value)
  } else {
    // TODO special case for <input v-model type="checkbox">
    setAttr(el, key, value)
  }
}

export function setDynamicProps(el: Element, ...args: any): void {
  const oldProps = getMetadata(el)[MetadataKind.prop]
  const props = args.length > 1 ? mergeProps(...args) : args[0]

  for (const key in oldProps) {
    // TODO should these keys be allowed as dynamic keys? The current logic of the runtime-core will throw an error
    if (key === 'textContent' || key === 'innerHTML') {
      continue
    }

    const hasNewValue = props[key] || props['.' + key] || props['^' + key]
    if (oldProps[key] && !hasNewValue) {
      setDynamicProp(el, key, null)
    }
  }

  for (const key in props) {
    setDynamicProp(el, key, props[key])
  }
}

// TODO copied from runtime-core
export function mergeProps(...args: Data[]): Data {
  const ret: Data = {}
  for (let i = 0; i < args.length; i++) {
    const toMerge = args[i]
    for (const key in toMerge) {
      if (key === 'class') {
        if (ret.class !== toMerge.class) {
          ret.class = normalizeClass([ret.class, toMerge.class])
        }
      } else if (key === 'style') {
        ret.style = normalizeStyle([ret.style, toMerge.style])
      } else if (isOn(key)) {
        const existing = ret[key]
        const incoming = toMerge[key]
        if (
          incoming &&
          existing !== incoming &&
          !(isArray(existing) && existing.includes(incoming))
        ) {
          ret[key] = existing
            ? [].concat(existing as any, incoming as any)
            : incoming
        }
      } else if (key !== '') {
        ret[key] = toMerge[key]
      }
    }
  }
  return ret
}

export function setText(el: Node, ...values: any[]): void {
  const text = values.map(v => toDisplayString(v)).join('')
  const oldVal = recordPropMetadata(el, 'textContent', text)
  if (text !== oldVal) {
    el.textContent = text
  }
}

export function setHtml(el: Element, value: any): void {
  const oldVal = recordPropMetadata(el, 'innerHTML', value)
  if (value !== oldVal) {
    el.innerHTML = value
  }
}

// TODO copied from runtime-dom
function shouldSetAsProp(
  el: Element,
  key: string,
  value: unknown,
  isSVG: boolean,
) {
  if (isSVG) {
    // most keys must be set as attribute on svg elements to work
    // ...except innerHTML & textContent
    if (key === 'innerHTML' || key === 'textContent') {
      return true
    }
    // or native onclick with function values
    if (key in el && isNativeOn(key) && isFunction(value)) {
      return true
    }
    return false
  }

  // these are enumerated attrs, however their corresponding DOM properties
  // are actually booleans - this leads to setting it with a string "false"
  // value leading it to be coerced to `true`, so we need to always treat
  // them as attributes.
  // Note that `contentEditable` doesn't have this problem: its DOM
  // property is also enumerated string values.
  if (key === 'spellcheck' || key === 'draggable' || key === 'translate') {
    return false
  }

  // #1787, #2840 form property on form elements is readonly and must be set as
  // attribute.
  if (key === 'form') {
    return false
  }

  // #1526 <input list> must be set as attribute
  if (key === 'list' && el.tagName === 'INPUT') {
    return false
  }

  // #2766 <textarea type> must be set as attribute
  if (key === 'type' && el.tagName === 'TEXTAREA') {
    return false
  }

  // #8780 the width or height of embedded tags must be set as attribute
  if (key === 'width' || key === 'height') {
    const tag = el.tagName
    if (
      tag === 'IMG' ||
      tag === 'VIDEO' ||
      tag === 'CANVAS' ||
      tag === 'SOURCE'
    ) {
      return false
    }
  }

  // native onclick with string value, must be set as attribute
  if (isNativeOn(key) && isString(value)) {
    return false
  }

  return key in el
}
