const XLINK_NS = 'http://www.w3.org/1999/xlink'
const XLINK_PREFIX = 'xlink:'

function isXlink(name: string): boolean {
  return name.startsWith(XLINK_PREFIX)
}

function getXlinkProp(name: string): string {
  return isXlink(name) ? name.slice(6) : ''
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
      el.removeAttributeNS(XLINK_NS, getXlinkProp(key))
    } else {
      el.setAttributeNS(XLINK_NS, key, value)
    }
  } else {
    if (value == null) {
      el.removeAttribute(key)
    } else {
      el.setAttribute(key, value)
    }
  }
}
