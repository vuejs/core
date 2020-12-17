// __UNSAFE__
// Reason: potentially setting innerHTML.
// This can come from explicit usage of v-html or innerHTML as a prop in render

import { warn } from '@vue/runtime-core'

// Set prop with error handling,throws warnings when change readonly prop.
function setProp(el: any, key: string, value: any) {
  try {
    el[key] = value
  } catch (e) {
    if (__DEV__) {
      warn(
        `Failed setting prop "${key}" on <${el.tagName.toLowerCase()}>: ` +
          `value ${value} is invalid.`,
        e
      )
    }
  }
}

// functions. The user is responsible for using them with only trusted content.
export function patchDOMProp(
  el: any,
  key: string,
  value: any,
  // the following args are passed only due to potential innerHTML/textContent
  // overriding existing VNodes, in which case the old tree must be properly
  // unmounted.
  prevChildren: any,
  parentComponent: any,
  parentSuspense: any,
  unmountChildren: any
) {
  if (key === 'innerHTML' || key === 'textContent') {
    if (prevChildren) {
      unmountChildren(prevChildren, parentComponent, parentSuspense)
    }
    setProp(el, key, value == null ? '' : value)
    return
  }

  if (key === 'value' && el.tagName !== 'PROGRESS') {
    // store value as _value as well since
    // non-string values will be stringified.
    el._value = value
    const newValue = value == null ? '' : value
    if (el.value !== newValue) {
      el.value = newValue
    }
    return
  }

  if (value === '' || value == null) {
    const type = typeof el[key]
    if (value === '' && type === 'boolean') {
      // e.g. <select multiple> compiles to { multiple: '' }
      setProp(el, key, true)
      return
    } else if (value == null && type === 'string') {
      // e.g. <div :id="null">
      setProp(el, key, '')
      el.removeAttribute(key)
      return
    } else if (type === 'number') {
      // e.g. <img :width="null">
      setProp(el, key, 0)
      el.removeAttribute(key)
      return
    }
  }

  setProp(el, key, value)
}
