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
import { inOnce, withOnce } from '../once'
import { isArray, isSet, looseEqual, remove } from '@vue/shared'
import {
  Dep,
  getCurrentScope,
  onScopeDispose,
  trackDep,
  traverse,
} from '@vue/reactivity'
import type { VaporComponentInstance } from '../component'
import { isInteropEnabled } from '../vdomInteropState'

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
    // Deferred work keeps the branch scope and once ambient it was created under.
    let scope = getCurrentScope()
    const run = inOnce ? () => withOnce(cb) : cb
    onMounted(() => {
      const currentScope = scope!
      scope = undefined
      if (currentScope.active) currentScope.run(run)
    })
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
  el: HTMLInputElement & { _valueDep?: Dep },
  get,
  set,
) => {
  vModelCheckboxInit(el, set)
  ensureMounted(() => {
    let value: any
    renderEffect(() => {
      const oldValue = value
      // #4096 array checkboxes need to be deep traversed
      value = traverse(get())
      if (!inOnce && (isArray(value) || isSet(value))) {
        // Track the effective value, including merged and fallthrough bindings.
        trackDep(el._valueDep || (el._valueDep = new Dep()), el, '_value')
      }
      vModelCheckboxUpdate(el, oldValue, value)
    })
  })
}

export const applyRadioModel: VaporModelDirective<HTMLInputElement> = (
  el,
  get,
  set,
) => {
  // static listener: lives and dies with the element, no disposer needed
  el.addEventListener('change', () => set(vModelGetValue(el)))
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
  if (inOnce) {
    ensureMounted(() => vModelSetSelected(el, get()))
    return
  }
  // The owner's effects can update options directly or through child inputs
  // without touching the model. Apply selection after their DOM updates.
  const instance = currentInstance as VaporComponentInstance
  let active = true
  const update = () => {
    if (active) vModelSetSelected(el, get())
  }
  const updates =
    isInteropEnabled && !instance.vapor
      ? instance.u || (instance.u = [])
      : instance.selectUpdates || (instance.selectUpdates = [])
  updates.unshift(update)
  onScopeDispose(() => {
    active = false
    remove(updates, update)
  })
  ensureMounted(() => {
    update()
    // Only tracks the model; the queued selection update applies it.
    renderEffect(() => traverse(get()))
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
