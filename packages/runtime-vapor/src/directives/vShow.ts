import type { ObjectDirective } from '../directives'

const vShowMap = new WeakMap<HTMLElement, string>()

export const vShow: ObjectDirective<HTMLElement> = {
  beforeMount(node, { value }) {
    vShowMap.set(node, node.style.display === 'none' ? '' : node.style.display)
    setDisplay(node, value)
  },

  updated(node, { value, oldValue }) {
    if (!value === !oldValue) return
    setDisplay(node, value)
  },

  beforeUnmount(node, { value }) {
    setDisplay(node, value)
  },
}

function setDisplay(el: HTMLElement, value: unknown): void {
  el.style.display = value ? vShowMap.get(el)! : 'none'
}
