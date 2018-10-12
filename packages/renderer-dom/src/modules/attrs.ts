const xlinkNS = 'http://www.w3.org/1999/xlink'

function isXlink(name: string): boolean {
  return name.charAt(5) === ':' && name.slice(0, 5) === 'xlink'
}

function getXlinkProp(name: string): string {
  return isXlink(name) ? name.slice(6, name.length) : ''
}

export function patchAttr(
  el: Element,
  key: string,
  value: any,
  isSVG: boolean
) {
  // isSVG short-circuits isXlink check
  if (isSVG && isXlink(key)) {
    if (value == null) {
      el.removeAttributeNS(xlinkNS, getXlinkProp(key))
    } else {
      el.setAttributeNS(xlinkNS, key, value)
    }
  } else {
    if (value == null) {
      el.removeAttribute(key)
    } else {
      el.setAttribute(key, value)
    }
  }
}
