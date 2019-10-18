import { Directive } from '@vue/runtime-core'

type ShowGuardElement = ElementCSSInlineStyle & {
  __vOriginalDisplay: string | null
}

//TODO: interaction with transition module
export const vShowGuard: Directive<ShowGuardElement> = {
  beforeMount: (el, { value }) => {
    setOriginalDisplay(el)
    setElementDisplayByValue(el, value)
  },
  updated: (el, { value, oldValue }) => {
    if (!value === !oldValue) return
    setElementDisplayByValue(el, value)
  },
  beforeUnmount: el => {
    setElementDisplayByValue(el, true)
  }
}

function setOriginalDisplay(el: ShowGuardElement): void {
  el.__vOriginalDisplay = el.style.display === 'none' ? '' : el.style.display
}

function setElementDisplayByValue(el: ShowGuardElement, value: any): void {
  el.style.display = value ? el.__vOriginalDisplay : 'none'
}
