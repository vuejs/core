import type { ObjectDirective } from '@vue/runtime-core'

export type VHtmlElementDirective = ObjectDirective<HTMLElement> & {
  name: '__v-html'
}
// only work with resolveDynamicComponent
export const vHtml: VHtmlElementDirective = {
  name: '__v-html',
  beforeMount(el, { value }) {
    setInnerHTML(el, value)
  },
  updated(el, { value, oldValue }) {
    if (!value === !oldValue) return
    setInnerHTML(el, value)
  },
  beforeUnmount(el, { value }) {
    setInnerHTML(el, value)
  },
}

function setInnerHTML(el: HTMLElement, value: unknown): void {
  el.innerHTML = String(value)
}
