import {
  type Data,
  includeBooleanAttr,
  isArray,
  isFunction,
  isOn,
  isString,
  normalizeClass,
  normalizeStyle,
  toDisplayString,
} from '@vue/shared'
import { currentInstance } from '../component'
import { warn } from '../warning'

export function recordPropMetadata(el: Node, key: string, value: any): any {
  if (!currentInstance) {
    // TODO implement error handling
    if (__DEV__) throw new Error('cannot be used out of component')
    return
  }
  let metadata = currentInstance.metadata.get(el)
  if (!metadata) {
    currentInstance.metadata.set(el, (metadata = { props: {} }))
  }
  const prev = metadata.props[key]
  metadata.props[key] = value
  return prev
}

export function setClass(el: Element, value: any) {
  const prev = recordPropMetadata(el, 'class', (value = normalizeClass(value)))
  if (value !== prev && (value || prev)) {
    el.className = value
  }
}

export function setStyle(el: HTMLElement, value: any) {
  const prev = recordPropMetadata(el, 'style', (value = normalizeStyle(value)))
  if (value !== prev && (value || prev)) {
    if (typeof value === 'string') {
      el.style.cssText = value
    } else {
      // TODO
    }
  }
}

export function setAttr(el: Element, key: string, value: any) {
  const oldVal = recordPropMetadata(el, key, value)
  if (value !== oldVal) {
    if (value != null) {
      el.setAttribute(key, value)
    } else {
      el.removeAttribute(key)
    }
  }
}

export function setDOMProp(el: any, key: string, value: any) {
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

export function setDynamicProp(el: Element, key: string, value: any) {
  // TODO
  const isSVG = false
  if (key === 'class') {
    setClass(el, value)
  } else if (key === 'style') {
    setStyle(el as HTMLElement, value)
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

export function setDynamicProps(el: Element, ...args: any) {
  const props = args.length > 1 ? mergeProps(...args) : args[0]

  // TODO remove all of old props before set new props since there is containing dynamic key
  for (const key in props) {
    setDynamicProp(el, key, props[key])
  }
}

// TODO copied from runtime-core
function mergeProps(...args: Data[]) {
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

export function setText(el: Node, value: any) {
  const oldVal = recordPropMetadata(
    el,
    'textContent',
    (value = toDisplayString(value)),
  )
  if (value !== oldVal) {
    el.textContent = value
  }
}

export function setHtml(el: Element, value: any) {
  const oldVal = recordPropMetadata(el, 'innerHTML', value)
  if (value !== oldVal) {
    el.innerHTML = value
  }
}

// TODO copied from runtime-dom
const isNativeOn = (key: string) =>
  key.charCodeAt(0) === 111 /* o */ &&
  key.charCodeAt(1) === 110 /* n */ &&
  // lowercase letter
  key.charCodeAt(2) > 96 &&
  key.charCodeAt(2) < 123

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
