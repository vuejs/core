// TODO explain why we are no longer checking boolean/enumerated here

export function patchAttr(
  el: Element,
  key: string,
  value: any,
  isSVG: boolean
) {
  if (isSVG && key.indexOf('xlink:') === 0) {
    // TODO handle xlink
  } else if (value == null) {
    el.removeAttribute(key)
  } else {
    // TODO in dev mode, warn against incorrect values for boolean or
    // enumerated attributes
    el.setAttribute(key, value)
  }
}
