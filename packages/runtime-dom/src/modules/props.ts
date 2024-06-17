// __UNSAFE__
// Reason: potentially setting innerHTML.
// This can come from explicit usage of v-html or innerHTML as a prop in render

import { DeprecationTypes, compatUtils, warn } from '@vue/runtime-core'
import { includeBooleanAttr } from '@vue/shared'

// functions. The user is responsible for using them with only trusted content.
export function patchDOMProp(
  el: any,
  key: string,
  prevValue: any,
  nextValue: any,
  parentComponent: any,
) {
  if (key === 'innerHTML' || key === 'textContent') {
    if (prevValue && nextValue == null) return
    el[key] = nextValue == null ? '' : nextValue
    return
  }

  const tag = el.tagName

  if (
    key === 'value' &&
    tag !== 'PROGRESS' &&
    // custom elements may use _value internally
    !tag.includes('-')
  ) {
    // #4956: <option> value will fallback to its text content so we need to
    // compare against its attribute value instead.
    const oldValue =
      tag === 'OPTION' ? el.getAttribute('value') || '' : el.value
    const newValue = nextValue == null ? '' : String(nextValue)
    if (oldValue !== newValue || !('_value' in el)) {
      el.value = newValue
    }
    if (nextValue == null) {
      el.removeAttribute(key)
    }
    // store value as _value as well since
    // non-string values will be stringified.
    el._value = nextValue
    return
  }

  let needRemove = false
  if (nextValue === '' || nextValue == null) {
    const type = typeof el[key]
    if (type === 'boolean') {
      // e.g. <select multiple> compiles to { multiple: '' }
      nextValue = includeBooleanAttr(nextValue)
    } else if (nextValue == null && type === 'string') {
      // e.g. <div :id="null">
      nextValue = ''
      needRemove = true
    } else if (type === 'number') {
      // e.g. <img :width="null">
      nextValue = 0
      needRemove = true
    }
  } else {
    if (
      __COMPAT__ &&
      nextValue === false &&
      compatUtils.isCompatEnabled(
        DeprecationTypes.ATTR_FALSE_VALUE,
        parentComponent,
      )
    ) {
      const type = typeof el[key]
      if (type === 'string' || type === 'number') {
        __DEV__ &&
          compatUtils.warnDeprecation(
            DeprecationTypes.ATTR_FALSE_VALUE,
            parentComponent,
            key,
          )
        nextValue = type === 'number' ? 0 : ''
        needRemove = true
      }
    }
  }

  // some properties perform value validation and throw,
  // some properties has getter, no setter, will error in 'use strict'
  // eg. <select :type="null"></select> <select :willValidate="null"></select>
  try {
    el[key] = nextValue
  } catch (e: any) {
    // do not warn if value is auto-coerced from nullish values
    if (__DEV__ && !needRemove) {
      warn(
        `Failed setting prop "${key}" on <${tag.toLowerCase()}>: ` +
          `value ${nextValue} is invalid.`,
        e,
      )
    }
  }
  needRemove && el.removeAttribute(key)
}
