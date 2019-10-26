import {
  ObjectDirective,
  VNode,
  DirectiveBinding,
  warn
} from '@vue/runtime-core'
import { addEventListener } from '../modules/events'
import { isArray, isObject } from '@vue/shared'

const getModelAssigner = (vnode: VNode): ((value: any) => void) =>
  vnode.props!['onUpdate:modelValue']

function onCompositionStart(e: CompositionEvent) {
  ;(e.target as any).composing = true
}

function onCompositionEnd(e: CompositionEvent) {
  const target = e.target as any
  if (target.composing) {
    target.composing = false
    trigger(target, 'input')
  }
}

function trigger(el: HTMLElement, type: string) {
  const e = document.createEvent('HTMLEvents')
  e.initEvent(type, true, true)
  el.dispatchEvent(e)
}

function toNumber(val: string): number | string {
  const n = parseFloat(val)
  return isNaN(n) ? val : n
}

// We are exporting the v-model runtime directly as vnode hooks so that it can
// be tree-shaken in case v-model is never used.
export const vModelText: ObjectDirective<
  HTMLInputElement | HTMLTextAreaElement
> = {
  beforeMount(el, { value, modifiers: { lazy, trim, number } }, vnode) {
    el.value = value
    const assign = getModelAssigner(vnode)
    const castToNumber = number || el.type === 'number'
    addEventListener(el, lazy ? 'change' : 'input', () => {
      let domValue: string | number = el.value
      if (trim) {
        domValue = domValue.trim()
      } else if (castToNumber) {
        domValue = toNumber(domValue)
      }
      assign(domValue)
    })
    if (trim) {
      addEventListener(el, 'change', () => {
        el.value = el.value.trim()
      })
    }
    if (!lazy) {
      addEventListener(el, 'compositionstart', onCompositionStart)
      addEventListener(el, 'compositionend', onCompositionEnd)
      // Safari < 10.2 & UIWebView doesn't fire compositionend when
      // switching focus before confirming composition choice
      // this also fixes the issue where some browsers e.g. iOS Chrome
      // fires "change" instead of "input" on autocomplete.
      addEventListener(el, 'change', onCompositionEnd)
    }
  },
  beforeUpdate(el, { value, oldValue, modifiers: { trim, number } }) {
    if (value === oldValue) {
      return
    }
    if (document.activeElement === el) {
      if (trim && el.value.trim() === value) {
        return
      }
      if ((number || el.type === 'number') && toNumber(el.value) === value) {
        return
      }
    }
    el.value = value
  }
}

export const vModelCheckbox: ObjectDirective<HTMLInputElement> = {
  beforeMount(el, binding, vnode) {
    setChecked(el, binding, vnode)
    const assign = getModelAssigner(vnode)
    addEventListener(el, 'change', () => {
      const modelValue = (el as any)._modelValue
      const elementValue = getValue(el)
      const checked = el.checked
      if (isArray(modelValue)) {
        const index = looseIndexOf(modelValue, elementValue)
        const found = index !== -1
        if (checked && !found) {
          assign(modelValue.concat(elementValue))
        } else if (!checked && found) {
          const filtered = [...modelValue]
          filtered.splice(index, 1)
          assign(filtered)
        }
      } else {
        assign(checked)
      }
    })
  },
  beforeUpdate: setChecked
}

function setChecked(
  el: HTMLInputElement,
  { value, oldValue }: DirectiveBinding,
  vnode: VNode
) {
  // store the v-model value on the element so it can be accessed by the
  // change listener.
  ;(el as any)._modelValue = value
  if (isArray(value)) {
    el.checked = looseIndexOf(value, vnode.props!.value) > -1
  } else if (value !== oldValue) {
    el.checked = !!value
  }
}

export const vModelRadio: ObjectDirective<HTMLInputElement> = {
  beforeMount(el, { value }, vnode) {
    el.checked = looseEqual(value, vnode.props!.value)
    const assign = getModelAssigner(vnode)
    addEventListener(el, 'change', () => {
      assign(getValue(el))
    })
  },
  beforeUpdate(el, { value, oldValue }, vnode) {
    if (value !== oldValue) {
      el.checked = looseEqual(value, vnode.props!.value)
    }
  }
}

export const vModelSelect: ObjectDirective<HTMLSelectElement> = {
  // use mounted & updated because <select> relies on its children <option>s.
  mounted(el, { value }, vnode) {
    setSelected(el, value)
    const assign = getModelAssigner(vnode)
    addEventListener(el, 'change', () => {
      const selectedVal = Array.prototype.filter
        .call(el.options, (o: HTMLOptionElement) => o.selected)
        .map(getValue)
      assign(el.multiple ? selectedVal : selectedVal[0])
    })
  },
  updated(el, { value }) {
    setSelected(el, value)
  }
}

function setSelected(el: HTMLSelectElement, value: any) {
  const isMultiple = el.multiple
  if (isMultiple && !isArray(value)) {
    __DEV__ &&
      warn(
        `<select multiple v-model> expects an Array value for its binding, ` +
          `but got ${Object.prototype.toString.call(value).slice(8, -1)}.`
      )
    return
  }
  for (let i = 0, l = el.options.length; i < l; i++) {
    const option = el.options[i]
    const optionValue = getValue(option)
    if (isMultiple) {
      option.selected = looseIndexOf(value, optionValue) > -1
    } else {
      if (looseEqual(getValue(option), value)) {
        el.selectedIndex = i
        return
      }
    }
  }
  if (!isMultiple) {
    el.selectedIndex = -1
  }
}

function looseEqual(a: any, b: any): boolean {
  if (a === b) return true
  const isObjectA = isObject(a)
  const isObjectB = isObject(b)
  if (isObjectA && isObjectB) {
    try {
      const isArrayA = isArray(a)
      const isArrayB = isArray(b)
      if (isArrayA && isArrayB) {
        return (
          a.length === b.length &&
          a.every((e: any, i: any) => looseEqual(e, b[i]))
        )
      } else if (a instanceof Date && b instanceof Date) {
        return a.getTime() === b.getTime()
      } else if (!isArrayA && !isArrayB) {
        const keysA = Object.keys(a)
        const keysB = Object.keys(b)
        return (
          keysA.length === keysB.length &&
          keysA.every(key => looseEqual(a[key], b[key]))
        )
      } else {
        /* istanbul ignore next */
        return false
      }
    } catch (e) {
      /* istanbul ignore next */
      return false
    }
  } else if (!isObjectA && !isObjectB) {
    return String(a) === String(b)
  } else {
    return false
  }
}

function looseIndexOf(arr: any[], val: any): number {
  return arr.findIndex(item => looseEqual(item, val))
}

// retrieve raw value set via :value bindings
function getValue(el: HTMLOptionElement | HTMLInputElement) {
  return '_value' in el ? (el as any)._value : el.value
}

export const vModelDynamic: ObjectDirective<
  HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
> = {
  beforeMount(el, binding, vnode) {
    callModelHook(el, binding, vnode, null, 'beforeMount')
  },
  mounted(el, binding, vnode) {
    callModelHook(el, binding, vnode, null, 'mounted')
  },
  beforeUpdate(el, binding, vnode, prevVNode) {
    callModelHook(el, binding, vnode, prevVNode, 'beforeUpdate')
  },
  updated(el, binding, vnode, prevVNode) {
    callModelHook(el, binding, vnode, prevVNode, 'updated')
  }
}

function callModelHook(
  el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  binding: DirectiveBinding,
  vnode: VNode,
  prevVNode: VNode | null,
  hook: keyof ObjectDirective
) {
  let modelToUse: ObjectDirective
  switch (el.tagName) {
    case 'SELECT':
      modelToUse = vModelSelect
      break
    case 'TEXTAREA':
      modelToUse = vModelText
      break
    default:
      switch (el.type) {
        case 'checkbox':
          modelToUse = vModelCheckbox
          break
        case 'radio':
          modelToUse = vModelRadio
          break
        default:
          modelToUse = vModelText
      }
  }
  const fn = modelToUse[hook]
  fn && fn(el, binding, vnode, prevVNode)
}
