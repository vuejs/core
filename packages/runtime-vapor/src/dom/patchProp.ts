import {
  isFunction,
  isString,
  normalizeClass,
  normalizeStyle,
} from '@vue/shared'

export function setClass(el: Element, oldVal: any, newVal: any) {
  if ((newVal = normalizeClass(newVal)) !== oldVal && (newVal || oldVal)) {
    el.className = newVal
  }
}

export function setStyle(el: HTMLElement, oldVal: any, newVal: any) {
  if ((newVal = normalizeStyle(newVal)) !== oldVal && (newVal || oldVal)) {
    if (typeof newVal === 'string') {
      el.style.cssText = newVal
    } else {
      // TODO
    }
  }
}

export function setAttr(el: Element, key: string, oldVal: any, newVal: any) {
  if (newVal !== oldVal) {
    if (newVal != null) {
      el.setAttribute(key, newVal)
    } else {
      el.removeAttribute(key)
    }
  }
}

export function setDOMProp(el: any, key: string, oldVal: any, newVal: any) {
  // TODO special checks
  if (newVal !== oldVal) {
    el[key] = newVal
  }
}

export function setDynamicProp(
  el: Element,
  key: string,
  oldVal: any,
  newVal: any,
) {
  // TODO
  const isSVG = false
  if (key === 'class') {
    setClass(el, oldVal, newVal)
  } else if (key === 'style') {
    setStyle(el as HTMLElement, oldVal, newVal)
  } else if (
    key[0] === '.'
      ? ((key = key.slice(1)), true)
      : key[0] === '^'
        ? ((key = key.slice(1)), false)
        : shouldSetAsProp(el, key, newVal, isSVG)
  ) {
    setDOMProp(el, key, oldVal, newVal)
  } else {
    // TODO special case for <input v-model type="checkbox">
    setAttr(el, key, oldVal, newVal)
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
