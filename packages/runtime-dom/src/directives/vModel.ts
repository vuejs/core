import {
  ObjectDirective,
  VNode,
  DirectiveHook,
  DirectiveBinding,
  warn
} from '@vue/runtime-core'
import { addEventListener } from '../modules/events'
import {
  isArray,
  looseEqual,
  looseIndexOf,
  invokeArrayFns,
  toNumber
} from '@vue/shared'

type AssignerFn = (value: any) => void

const getModelAssigner = (vnode: VNode): AssignerFn => {
  const fn = vnode.props!['onUpdate:modelValue']
  return isArray(fn) ? value => invokeArrayFns(fn, value) : fn
}

function onCompositionStart(e: Event) {
  ;(e.target as any).composing = true
}

function onCompositionEnd(e: Event) {
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

type ModelDirective<T> = ObjectDirective<T & { _assign: AssignerFn }>

// We are exporting the v-model runtime directly as vnode hooks so that it can
// be tree-shaken in case v-model is never used.
export const vModelText: ModelDirective<
  HTMLInputElement | HTMLTextAreaElement
> = {
  beforeMount(el, { value, modifiers: { lazy, trim, number } }, vnode) {
    el.value = value
    el._assign = getModelAssigner(vnode)
    const castToNumber = number || el.type === 'number'
    addEventListener(el, lazy ? 'change' : 'input', e => {
      if ((e.target as any).composing) return
      let domValue: string | number = el.value
      if (trim) {
        domValue = domValue.trim()
      } else if (castToNumber) {
        domValue = toNumber(domValue)
      }
      el._assign(domValue)
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
  beforeUpdate(el, { value, oldValue, modifiers: { trim, number } }, vnode) {
    el._assign = getModelAssigner(vnode)
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

export const vModelCheckbox: ModelDirective<HTMLInputElement> = {
  beforeMount(el, binding, vnode) {
    setChecked(el, binding, vnode)
    el._assign = getModelAssigner(vnode)
    addEventListener(el, 'change', () => {
      const modelValue = (el as any)._modelValue
      const elementValue = getValue(el)
      const checked = el.checked
      const assign = el._assign
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
        assign(getCheckboxValue(el, checked))
      }
    })
  },
  beforeUpdate(el, binding, vnode) {
    el._assign = getModelAssigner(vnode)
    setChecked(el, binding, vnode)
  }
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
    el.checked = looseEqual(value, getCheckboxValue(el, true))
  }
}

export const vModelRadio: ModelDirective<HTMLInputElement> = {
  beforeMount(el, { value }, vnode) {
    el.checked = looseEqual(value, vnode.props!.value)
    el._assign = getModelAssigner(vnode)
    addEventListener(el, 'change', () => {
      el._assign(getValue(el))
    })
  },
  beforeUpdate(el, { value, oldValue }, vnode) {
    el._assign = getModelAssigner(vnode)
    if (value !== oldValue) {
      el.checked = looseEqual(value, vnode.props!.value)
    }
  }
}

export const vModelSelect: ModelDirective<HTMLSelectElement> = {
  // use mounted & updated because <select> relies on its children <option>s.
  mounted(el, { value }, vnode) {
    setSelected(el, value)
    el._assign = getModelAssigner(vnode)
    addEventListener(el, 'change', () => {
      const selectedVal = Array.prototype.filter
        .call(el.options, (o: HTMLOptionElement) => o.selected)
        .map(getValue)
      el._assign(el.multiple ? selectedVal : selectedVal[0])
    })
  },
  beforeUpdate(el, _binding, vnode) {
    el._assign = getModelAssigner(vnode)
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

// retrieve raw value set via :value bindings
function getValue(el: HTMLOptionElement | HTMLInputElement) {
  return '_value' in el ? (el as any)._value : el.value
}

// retrieve raw value for true-value and false-value set via :true-value or :false-value bindings
function getCheckboxValue(
  el: HTMLInputElement & { _trueValue?: any; _falseValue?: any },
  checked: boolean
) {
  const key = checked ? '_trueValue' : '_falseValue'
  return key in el ? el[key] : checked
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
  hook: 'beforeMount' | 'mounted' | 'beforeUpdate' | 'updated'
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
  const fn = modelToUse[hook] as DirectiveHook
  fn && fn(el, binding, vnode, prevVNode)
}

// SSR vnode transforms
if (__NODE_JS__) {
  vModelText.getSSRProps = ({ value }) => ({ value })

  vModelRadio.getSSRProps = ({ value }, vnode) => {
    if (vnode.props && looseEqual(vnode.props.value, value)) {
      return { checked: true }
    }
  }

  vModelCheckbox.getSSRProps = ({ value }, vnode) => {
    if (isArray(value)) {
      if (vnode.props && looseIndexOf(value, vnode.props.value) > -1) {
        return { checked: true }
      }
    } else if (value) {
      return { checked: true }
    }
  }
}
