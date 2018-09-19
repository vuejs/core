// compiler should normlaize class + :class bindings on the same element
// into a single binding ['staticClass', dynamic]

export function patchClass(el: Element, value: any, isSVG: boolean) {
  // directly setting className should be faster than setAttribute in theory
  if (isSVG) {
    el.setAttribute('class', normalizeClass(value))
  } else {
    el.className = normalizeClass(value)
  }
}

function normalizeClass(value: any): string {
  let res = ''
  if (typeof value === 'string') {
    res = value
  } else if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      res += normalizeClass(value[i]) + ' '
    }
  } else if (typeof value === 'object') {
    for (const name in value) {
      if (value[name]) {
        res += name + ' '
      }
    }
  }
  return res.trim()
}
