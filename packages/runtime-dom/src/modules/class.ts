import { ElementWithTransition } from '../components/Transition'

// compiler should normalize class + :class bindings on the same element
// into a single binding ['staticClass', dynamic]
export function patchClass(el: Element, value: string, isSVG: boolean) {
  // directly setting className should be faster than setAttribute in theory
  if (isSVG) {
    el.setAttribute('class', value)
  } else {
    // if this is an element during a transition, take the temporary transition
    // classes into account.
    const transtionClasses = (el as ElementWithTransition)._vtc
    if (transtionClasses) {
      value = [value, ...transtionClasses].join(' ')
    }
    el.className = value
  }
}
