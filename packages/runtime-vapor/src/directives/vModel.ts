import { onMounted, vModelTextInit, vModelTextUpdate } from '@vue/runtime-dom'
import { renderEffect } from '../renderEffect'

type VaporModelDirective<T = Element> = (
  el: T,
  get: () => any,
  set: (v: any) => void,
  modifiers?: { number?: true; trim?: true; lazy?: true },
) => void

export const applyTextModel: VaporModelDirective<
  HTMLInputElement | HTMLTextAreaElement
> = (el, get, set, { trim, number, lazy } = {}) => {
  vModelTextInit(el, set, trim, number, lazy)
  onMounted(() => {
    let oldValue: any
    renderEffect(() => {
      const value = get()
      vModelTextUpdate(el, value, oldValue, trim, number, lazy)
      oldValue = value
    })
  })
}

export const applyRadioModel: VaporModelDirective = (el, get, set) => {}
export const applyCheckboxModel: VaporModelDirective = (el, get, set) => {}
export const applySelectModel: VaporModelDirective = (el, get, set) => {}
export const applyDynamicModel: VaporModelDirective = (el, get, set) => {}
