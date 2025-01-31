import {
  type VShowElement,
  vShowHidden,
  vShowOriginalDisplay,
} from '@vue/runtime-dom'
import { renderEffect } from '../renderEffect'

export function applyVShow(el: VShowElement, source: () => any): void {
  el[vShowOriginalDisplay] = el.style.display === 'none' ? '' : el.style.display
  renderEffect(() => setDisplay(el, source()))
}

function setDisplay(el: VShowElement, value: unknown): void {
  el.style.display = value ? el[vShowOriginalDisplay] : 'none'
  el[vShowHidden] = !value
}
