// __UNSAFE__
// Reason: potentially setting innerHTML.
// This can come from explicit usage of v-html or innerHTML as a prop in render

import { DeprecationTypes, compatUtils, warn } from '@vue/runtime-core'
import { includeBooleanAttr } from '@vue/shared'

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
  unmountChildren: any,
) {
  if (key === 'innerHTML' || key === 'textContent') {
    if (prevChildren) {
      unmountChildren(prevChildren, parentComponent, parentSuspense)
    }
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
  } else {
    if (
      __COMPAT__ &&
      value === false &&
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
        value = type === 'number' ? 0 : ''
        needRemove = true
      }
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
