import {
  currentInstance,
  onMounted,
  vModelCheckboxInit,
  vModelCheckboxUpdate,
  vModelGetValue,
  vModelSelectInit,
  vModelSetSelected,
  vModelTextInit,
  vModelTextUpdate,
} from '@vue/runtime-dom'
import { renderEffect } from '../renderEffect'
import { looseEqual } from '@vue/shared'
import { addEventListener } from '../dom/event'
import { traverse } from '@vue/reactivity'

type VaporModelDirective<
  T extends HTMLElement =
    | HTMLInputElement
    | HTMLTextAreaElement
    | HTMLSelectElement,
  Modifiers extends string = string,
> = (
  el: T,
  get: () => any,
  set: (v: any) => void,
  modifiers?: { [key in Modifiers]?: true },
) => void

function ensureMounted(cb: () => void) {
  if (currentInstance!.isMounted) {
    cb()
  } else {
    onMounted(cb)
  }
}

export const applyTextModel: VaporModelDirective<
  HTMLInputElement | HTMLTextAreaElement,
  'trim' | 'number' | 'lazy'
> = (el, get, set, { trim, number, lazy } = {}) => {
  vModelTextInit(el, trim, number, lazy, set)
  ensureMounted(() => {
    let value: any
    renderEffect(() => {
      vModelTextUpdate(el, value, (value = get()), trim, number, lazy)
    })
  })
}

export const applyCheckboxModel: VaporModelDirective<HTMLInputElement> = (
  el,
  get,
  set,
) => {
  vModelCheckboxInit(el, set)
  ensureMounted(() => {
    let value: any
    renderEffect(() => {
      vModelCheckboxUpdate(
        el,
        value,
        // #4096 array checkboxes need to be deep traversed
        traverse((value = get())),
      )
    })
  })
}

export const applyRadioModel: VaporModelDirective<HTMLInputElement> = (
  el,
  get,
  set,
) => {
  addEventListener(el, 'change', () => set(vModelGetValue(el)))
  ensureMounted(() => {
    let value: any
    renderEffect(() => {
      if (value !== (value = get())) {
        el.checked = looseEqual(value, vModelGetValue(el))
      }
    })
  })
}

export const applySelectModel: VaporModelDirective<
  HTMLSelectElement,
  'number'
> = (el, get, set, modifiers) => {
  vModelSelectInit(el, get(), modifiers && modifiers.number, set)
  ensureMounted(() => {
    renderEffect(() => vModelSetSelected(el, traverse(get())))
  })
}

export const applyDynamicModel: VaporModelDirective = (
  el,
  get,
  set,
  modifiers,
) => {
  let apply: VaporModelDirective<any> = applyTextModel
  if (el.tagName === 'SELECT') {
    apply = applySelectModel
  } else if (el.tagName === 'TEXTAREA') {
    apply = applyTextModel
  } else if ((el as HTMLInputElement).type === 'checkbox') {
    apply = applyCheckboxModel
  } else if ((el as HTMLInputElement).type === 'radio') {
    apply = applyRadioModel
  }
  apply(el, get, set, modifiers)
}
