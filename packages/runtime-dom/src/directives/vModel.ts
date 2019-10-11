import { Directive, VNode, DirectiveBinding, warn } from '@vue/runtime-core'
import { addEventListener } from '../modules/events'
import { looseEqual, isArray } from '@vue/shared'

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

// We are exporting the v-model runtime directly as vnode hooks so that it can
// be tree-shaken in case v-model is never used.
export const vModelText: Directive<HTMLInputElement | HTMLTextAreaElement> = {
  beforeMount(el, { value, modifiers: { lazy } }, vnode) {
    el.value = value
    const assign = getModelAssigner(vnode)
    addEventListener(el, lazy ? 'change' : 'input', () => {
      // TODO number & trim modifiers
      assign(el.value)
    })
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
  beforeUpdate(el, { value }) {
    // TODO number & trim handling
    el.value = value
  }
}

export const vModelCheckbox: Directive<HTMLInputElement> = {
  beforeMount(el, { value }, vnode) {
    // TODO handle array checkbox & number modifier
    el.checked = !!value
    const assign = getModelAssigner(vnode)
    addEventListener(el, 'change', () => {
      assign(el.checked)
    })
  },
  beforeUpdate(el, { value }) {
    el.checked = !!value
  }
}

export const vModelRadio: Directive<HTMLInputElement> = {
  beforeMount(el, { value }, vnode) {
    // TODO number modifier
    el.checked = looseEqual(value, vnode.props!.value)
    const assign = getModelAssigner(vnode)
    addEventListener(el, 'change', () => {
      assign(getValue(el))
    })
  },
  beforeUpdate(el, { value }, vnode) {
    // TODO number modifier
    el.checked = looseEqual(value, vnode.props!.value)
  }
}

export const vModelSelect: Directive<HTMLSelectElement> = {
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
          `but got ${Object.prototype.toString.call(value).slice(8, -1)}`
      )
    return
  }
  let selected, option
  for (let i = 0, l = el.options.length; i < l; i++) {
    option = el.options[i]
    if (isMultiple) {
      selected = looseIndexOf(value, getValue(option)) > -1
      if (option.selected !== selected) {
        option.selected = selected
      }
    } else {
      if (looseEqual(getValue(option), value)) {
        if (el.selectedIndex !== i) {
          el.selectedIndex = i
        }
        return
      }
    }
  }
  if (!isMultiple) {
    el.selectedIndex = -1
  }
}

function looseIndexOf(arr: Array<any>, val: any): number {
  for (let i = 0; i < arr.length; i++) {
    if (looseEqual(arr[i], val)) return i
  }
  return -1
}

// retrieve raw value set via :value bindings
function getValue(el: HTMLOptionElement | HTMLInputElement) {
  return '_value' in el ? (el as any)._value : el.value
}

export const vModelDynamic: Directive<
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
  hook: keyof Directive
) {
  let modelToUse: Directive
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
