import { ElementWithTransition } from '../components/Transition'

// compiler should normalize class + :class bindings on the same element
// into a single binding ['staticClass', dynamic]
export function patchClass(
  el: ElementWithTransition,
  value: string,
  isSVG: boolean
) {
  // if this is an element during a transition, take the temporary transition
  // classes into account.
  if (el._vtc) {
    value = [value, ...el._vtc].join(' ')
  }
  // directly setting className should be faster than setAttribute in theory
  if (isSVG) {
    el.setAttribute('class', value)
  } else {
    el.className = value
  }
}
