import { isSpecialBooleanAttr } from '@vue/shared'

export const xlinkNS = 'http://www.w3.org/1999/xlink'

export function patchAttr(
  el: Element,
  key: string,
  value: any,
  isSVG: boolean
) {
  if (isSVG && key.startsWith('xlink:')) {
    if (value == null) {
      el.removeAttributeNS(xlinkNS, key.slice(6, key.length))
    } else {
      el.setAttributeNS(xlinkNS, key, value)
    }
  } else {
    if (__COMPAT__ && compatCoerceAttr(el, key, value)) {
      return
    }

    // note we are only checking boolean attributes that don't have a
    // corresponding dom prop of the same name here.
    const isBoolean = isSpecialBooleanAttr(key)
    if (value == null || (isBoolean && value === false)) {
      el.removeAttribute(key)
    } else {
      el.setAttribute(key, isBoolean ? '' : value)
    }
  }
}

// 2.x compat
import { makeMap, NOOP } from '@vue/shared'
import { compatUtils, DeprecationTypes } from '@vue/runtime-core'

const isEnumeratedAttr = __COMPAT__
  ? /*#__PURE__*/ makeMap('contenteditable,draggable,spellcheck')
  : NOOP

export function compatCoerceAttr(
  el: Element,
  key: string,
  value: unknown
): boolean {
  if (isEnumeratedAttr(key)) {
    const v2CocercedValue =
      value === null
        ? 'false'
        : typeof value !== 'boolean' && value !== undefined
          ? 'true'
          : null
    if (
      v2CocercedValue &&
      compatUtils.softAssertCompatEnabled(
        DeprecationTypes.ATTR_ENUMERATED_COERSION,
        null,
        key,
        value,
        v2CocercedValue
      )
    ) {
      el.setAttribute(key, v2CocercedValue)
      return true
    }
  } else if (
    value === false &&
    !isSpecialBooleanAttr(key) &&
    compatUtils.softAssertCompatEnabled(
      DeprecationTypes.ATTR_FALSE_VALUE,
      null,
      key
    )
  ) {
    el.removeAttribute(key)
    return true
  }
  return false
}
