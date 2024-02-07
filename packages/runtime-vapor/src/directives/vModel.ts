import {
  invokeArrayFns,
  isArray,
  isSet,
  looseEqual,
  looseIndexOf,
  looseToNumber,
} from '@vue/shared'
import type { ComponentInternalInstance } from '../component'
import type {
  DirectiveBinding,
  DirectiveHook,
  DirectiveHookName,
  ObjectDirective,
} from '../directive'
import { addEventListener } from '../dom/event'
import { nextTick } from '../scheduler'
import { warn } from '../warning'

type AssignerFn = (value: any) => void
function getModelAssigner(
  el: Element,
  instance: ComponentInternalInstance,
): AssignerFn {
  const metadata = instance.metadata.get(el)!
  const fn: any = metadata.props['onUpdate:modelValue']
  return isArray(fn) ? value => invokeArrayFns(fn, value) : fn
}

function onCompositionStart(e: Event) {
  ;(e.target as any).composing = true
}

function onCompositionEnd(e: Event) {
  const target = e.target as any
  if (target.composing) {
    target.composing = false
    target.dispatchEvent(new Event('input'))
  }
}

const assignFnMap = new WeakMap<HTMLElement, AssignerFn>()
const assigningMap = new WeakMap<HTMLElement, boolean>()

// We are exporting the v-model runtime directly as vnode hooks so that it can
// be tree-shaken in case v-model is never used.
export const vModelText: ObjectDirective<
  HTMLInputElement | HTMLTextAreaElement,
  any,
  'lazy' | 'trim' | 'number'
> = {
  beforeMount(el, { instance, modifiers: { lazy, trim, number } = {} }) {
    const assigner = getModelAssigner(el, instance)
    assignFnMap.set(el, assigner)

    const castToNumber = number // || (vnode.props && vnode.props.type === 'number')
    addEventListener(el, lazy ? 'change' : 'input', e => {
      if ((e.target as any).composing) return
      let domValue: string | number = el.value
      if (trim) {
        domValue = domValue.trim()
      }
      if (castToNumber) {
        domValue = looseToNumber(domValue)
      }
      assigner(domValue)
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
  // set value on mounted so it's after min/max for type="range"
  mounted(el, { value }) {
    el.value = value == null ? '' : value
  },
  beforeUpdate(
    el,
    { instance, value, modifiers: { lazy, trim, number } = {} },
  ) {
    assignFnMap.set(el, getModelAssigner(el, instance))

    // avoid clearing unresolved text. #2302
    if ((el as any).composing) return

    const elValue =
      number || el.type === 'number' ? looseToNumber(el.value) : el.value
    const newValue = value == null ? '' : value

    if (elValue === newValue) {
      return
    }

    // eslint-disable-next-line no-restricted-globals
    if (document.activeElement === el && el.type !== 'range') {
      if (lazy) {
        return
      }
      if (trim && el.value.trim() === newValue) {
        return
      }
    }

    el.value = newValue
  },
}

// TODO
export const vModelRadio = {}

export const vModelSelect: ObjectDirective<HTMLSelectElement, any, 'number'> = {
  // <select multiple> value need to be deep traversed
  deep: true,
  beforeMount(el, { value, instance, modifiers: { number = false } = {} }) {
    const isSetModel = isSet(value)
    addEventListener(el, 'change', () => {
      const selectedVal = Array.prototype.filter
        .call(el.options, (o: HTMLOptionElement) => o.selected)
        .map((o: HTMLOptionElement) =>
          number ? looseToNumber(getValue(o, instance)) : getValue(o, instance),
        )
      assignFnMap.get(el)!(
        el.multiple
          ? isSetModel
            ? new Set(selectedVal)
            : selectedVal
          : selectedVal[0],
      )
      assigningMap.set(el, true)

      nextTick(() => {
        assigningMap.set(el, false)
      })
    })
    assignFnMap.set(el, getModelAssigner(el, instance))
    setSelected(el, instance, value, number)
  },
  beforeUpdate(el, { instance }) {
    assignFnMap.set(el, getModelAssigner(el, instance))
  },
  updated(
    el,
    { value, oldValue, instance, modifiers: { number = false } = {} },
  ) {
    if (!assigningMap.get(el)) {
      setSelected(el, instance, value, number)
    }
  },
}

function setSelected(
  el: HTMLSelectElement,
  instance: ComponentInternalInstance,
  value: any,
  number: boolean,
) {
  const isMultiple = el.multiple
  const isArrayValue = isArray(value)
  if (isMultiple && !isArrayValue && !isSet(value)) {
    __DEV__ &&
      warn(
        `<select multiple v-model> expects an Array or Set value for its binding, ` +
          `but got ${Object.prototype.toString.call(value).slice(8, -1)}.`,
      )
    return
  }

  for (let i = 0, l = el.options.length; i < l; i++) {
    const option = el.options[i]
    const optionValue = getValue(option, instance)
    if (isMultiple) {
      if (isArrayValue) {
        const optionType = typeof optionValue
        // fast path for string / number values
        if (optionType === 'string' || optionType === 'number') {
          option.selected = value.includes(
            number ? looseToNumber(optionValue) : optionValue,
          )
        } else {
          option.selected = looseIndexOf(value, optionValue) > -1
        }
      } else {
        option.selected = value.has(optionValue)
      }
    } else {
      if (looseEqual(getValue(option, instance), value)) {
        if (el.selectedIndex !== i) el.selectedIndex = i
        return
      }
    }
  }
  if (!isMultiple && el.selectedIndex !== -1) {
    el.selectedIndex = -1
  }
}

// retrieve raw value set via :value bindings
function getValue(
  el: HTMLOptionElement | HTMLInputElement,
  instance: ComponentInternalInstance,
) {
  const metadata = instance.metadata.get(el)
  return (metadata && metadata.props.value) || el.value
}

// retrieve raw value for true-value and false-value set via :true-value or :false-value bindings
function getCheckboxValue(
  el: HTMLInputElement,
  instance: ComponentInternalInstance,
  checked: boolean,
) {
  const metadata = instance.metadata.get(el)
  const props = metadata && metadata.props
  const key = checked ? 'true-value' : 'false-value'
  if (props && key in props) {
    return props[key]
  }
  if (el.hasAttribute(key)) {
    return el.getAttribute(key)
  }
  return checked
}

const setChecked: DirectiveHook<HTMLInputElement> = (
  el,
  { value, oldValue, instance },
) => {
  if (isArray(value)) {
    el.checked = looseIndexOf(value, getValue(el, instance)) > -1
  } else if (isSet(value)) {
    el.checked = value.has(getValue(el, instance))
  } else if (value !== oldValue) {
    el.checked = looseEqual(value, getCheckboxValue(el, instance, true))
  }
}

export const vModelCheckbox: ObjectDirective<HTMLInputElement> = {
  // #4096 array checkboxes need to be deep traversed
  deep: true,
  beforeMount(el, binding) {
    const { instance } = binding
    assignFnMap.set(el, getModelAssigner(el, binding.instance))

    addEventListener(el, 'change', () => {
      const modelValue = binding.value
      const elementValue = getValue(el, instance)
      const checked = el.checked
      const assigner = assignFnMap.get(el)!
      if (isArray(modelValue)) {
        const index = looseIndexOf(modelValue, elementValue)
        const found = index !== -1
        if (checked && !found) {
          assigner(modelValue.concat(elementValue))
        } else if (!checked && found) {
          const filtered = [...modelValue]
          filtered.splice(index, 1)
          assigner(filtered)
        }
      } else if (isSet(modelValue)) {
        const cloned = new Set(modelValue)
        if (checked) {
          cloned.add(elementValue)
        } else {
          cloned.delete(elementValue)
        }
        assigner(cloned)
      } else {
        assigner(getCheckboxValue(el, instance, checked))
      }
    })
  },
  // set initial checked on mount to wait for true-value/false-value
  mounted: setChecked,
  beforeUpdate(el, binding) {
    assignFnMap.set(el, getModelAssigner(el, binding.instance))
    setChecked(el, binding)
  },
}

export const vModelDynamic: ObjectDirective<
  HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
> = {
  beforeMount(el, binding) {
    callModelHook(el, binding, 'beforeMount')
  },
  mounted(el, binding) {
    callModelHook(el, binding, 'mounted')
  },
  beforeUpdate(el, binding) {
    callModelHook(el, binding, 'beforeUpdate')
  },
  updated(el, binding) {
    callModelHook(el, binding, 'updated')
  },
}

function resolveDynamicModel(
  tagName: string,
  type: string | null,
): ObjectDirective {
  switch (tagName) {
    case 'SELECT':
      return vModelSelect
    case 'TEXTAREA':
      return vModelText
    default:
      switch (type) {
        case 'checkbox':
          return vModelCheckbox
        case 'radio':
          return vModelRadio
        default:
          return vModelText
      }
  }
}

function callModelHook(
  el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  binding: DirectiveBinding,
  hook: DirectiveHookName,
) {
  const type = el.getAttribute('type')
  const modelToUse = resolveDynamicModel(el.tagName, type)
  const fn = modelToUse[hook]
  fn && fn(el, binding)
}
