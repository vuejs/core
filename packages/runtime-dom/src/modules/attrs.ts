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
