import { isArray } from '@vue/shared'

// compiler should normalize class + :class bindings on the same element
// into a single binding ['staticClass', dynamic]

export function patchClass(
  el: Element,
  value: string | string[],
  isSVG: boolean
) {
  // directly setting className should be faster than setAttribute in theory
  const _value = isArray(value) ? value.join(' ') : value
  if (isSVG) {
    el.setAttribute('class', _value)
  } else {
    el.className = _value
  }
}
