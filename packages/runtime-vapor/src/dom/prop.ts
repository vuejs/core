import {
  attributeCache,
  canSetValueDirectly,
  includeBooleanAttr,
  isArray,
  isFunction,
  isNativeOn,
  isOn,
  isString,
  normalizeClass,
  normalizeStyle,
  shouldSetAsAttr,
  toDisplayString,
} from '@vue/shared'
import { setStyle } from './style'
import { on } from './event'
import { currentInstance } from '../component'
import { warn } from '@vue/runtime-dom'

export function mergeInheritAttr(key: string, value: any): unknown {
  const instance = currentInstance!
  return mergeProp(key, instance.attrs[key], value)
}

export function setClass(el: Element, value: any, root?: boolean): void {
  el.className = normalizeClass(root ? mergeInheritAttr('class', value) : value)
}

export function setAttr(el: Element, key: string, value: any): void {
  if (value != null) {
    el.setAttribute(key, value)
  } else {
    el.removeAttribute(key)
  }
}

export function setValue(el: any, value: any): void {
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
        `Failed setting prop "${key}" on <${el.tagName.toLowerCase()}>: ` +
          `value ${value} is invalid.`,
        e,
      )
    }
  }
  needRemove && el.removeAttribute(key)
}

export function setDynamicProp(
  el: Element,
  key: string,
  prev: any,
  value: any,
): any {
  // TODO
  const isSVG = false
  if (key === 'class') {
    setClass(el, value)
  } else if (key === 'style') {
    return setStyle(el as HTMLElement, prev, value)
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
      return
    }

    if (key === 'textContent') {
      setText(el, value)
      return
    }

    const tag = el.tagName
    if (key === 'value' && canSetValueDirectly(tag)) {
      setValue(el, value)
      return
    }

    setDOMProp(el, key, value)
  } else {
    // TODO special case for <input v-model type="checkbox">
    setAttr(el, key, value)
  }
}

export function setDynamicProps(
  el: Element,
  oldProps: any,
  args: any[],
  root?: boolean,
): void {
  if (root) {
    args.unshift(currentInstance!.attrs)
  }
  const props = args.length > 1 ? mergeProps(...args) : args[0]

  if (oldProps) {
    for (const key in oldProps) {
      // TODO should these keys be allowed as dynamic keys? The current logic of the runtime-core will throw an error
      if (key === 'textContent' || key === 'innerHTML') {
        continue
      }

      const oldValue = oldProps[key]
      const hasNewValue = props[key] || props['.' + key] || props['^' + key]
      if (oldValue && !hasNewValue) {
        setDynamicProp(el, key, oldValue, null)
      }
    }
  }

  const prev = Object.create(null)
  for (const key in props) {
    setDynamicProp(
      el,
      key,
      oldProps ? oldProps[key] : undefined,
      (prev[key] = props[key]),
    )
  }

  return prev
}

export function mergeProp(
  key: string,
  existing: unknown,
  incoming: unknown,
): unknown {
  if (key === 'class') {
    if (existing !== incoming) {
      return normalizeClass([existing, incoming])
    }
  } else if (key === 'style') {
    return normalizeStyle([existing, incoming])
  } else if (isOn(key)) {
    if (
      incoming &&
      existing !== incoming &&
      !(isArray(existing) && existing.includes(incoming))
    ) {
      return existing ? [].concat(existing as any, incoming as any) : incoming
    }
  }
  return incoming
}

type Data = Record<string, any>

export function mergeProps(...args: Data[]): Data {
  const ret: Data = {}
  for (let i = 0; i < args.length; i++) {
    const toMerge = args[i]
    for (const key in toMerge) {
      if (key !== '') {
        ret[key] = mergeProp(key, ret[key], toMerge[key])
      }
    }
  }
  return ret
}

export function setText(el: Node, ...values: any[]): void {
  el.textContent = values.map(v => toDisplayString(v)).join('')
}

export function setHtml(el: Element, value: any): void {
  el.innerHTML = value == null ? '' : value
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

  const attrCacheKey = `${el.tagName}_${key}`
  if (
    attributeCache[attrCacheKey] === undefined
      ? (attributeCache[attrCacheKey] = shouldSetAsAttr(el.tagName, key))
      : attributeCache[attrCacheKey]
  ) {
    return false
  }

  // native onclick with string value, must be set as attribute
  if (isNativeOn(key) && isString(value)) {
    return false
  }

  return key in el
}
