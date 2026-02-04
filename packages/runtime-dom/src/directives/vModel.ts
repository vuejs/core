import {
  type DirectiveBinding,
  type DirectiveHook,
  type ObjectDirective,
  type VNode,
  nextTick,
  warn,
} from '@vue/runtime-core'
import { addEventListener } from '../modules/events'
import {
  invokeArrayFns,
  isArray,
  isSet,
  looseEqual,
  looseIndexOf,
  looseToNumber,
} from '@vue/shared'

type AssignerFn = (value: any) => void

const getModelAssigner = (vnode: VNode): AssignerFn => {
  const fn =
    vnode.props!['onUpdate:modelValue'] ||
    (__COMPAT__ && vnode.props!['onModelCompat:input'])
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

const assignKey: unique symbol = Symbol('_assign')
const hydratingKey: unique symbol = Symbol('_hydrating')
const hydrationValueKey: unique symbol = Symbol('_hydrateValue')
const hydrationSelectKey: unique symbol = Symbol('_hydrateSelect')

type ModelDirective<T, Modifiers extends string = string> = ObjectDirective<
  T & {
    [assignKey]: AssignerFn
    _assigning?: boolean
    [hydratingKey]?: boolean
    [hydrationValueKey]?: string
    [hydrationSelectKey]?: any
  },
  any,
  Modifiers
>

function castValue(value: string, trim?: boolean, number?: boolean | null) {
  if (trim) value = value.trim()
  if (number) value = looseToNumber(value)
  return value
}

// We are exporting the v-model runtime directly as vnode hooks so that it can
// be tree-shaken in case v-model is never used.
export const vModelText: ModelDirective<
  HTMLInputElement | HTMLTextAreaElement,
  'trim' | 'number' | 'lazy'
> = {
  created(el, { modifiers: { lazy, trim, number } }, vnode, _prev, hydrating) {
    el[hydratingKey] = hydrating
    if (hydrating) {
      el[hydrationValueKey] = el.value
    }
    el[assignKey] = getModelAssigner(vnode)
    const castToNumber =
      number || (vnode.props && vnode.props.type === 'number')
    addEventListener(el, lazy ? 'change' : 'input', e => {
      if ((e.target as any).composing) return
      el[assignKey](castValue(el.value, trim, castToNumber))
    })
    if (trim || castToNumber) {
      addEventListener(el, 'change', () => {
        el.value = castValue(el.value, trim, castToNumber)
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
  mounted(el, { value, modifiers: { trim, number } }, vnode) {
    const newValue = value == null ? '' : value
    const hydrating = el[hydratingKey]
    delete el[hydratingKey]
    const hydrateValue = el[hydrationValueKey]
    if (hydrateValue !== undefined) {
      delete el[hydrationValueKey]
    }
    // Users may edit the value before hydration. Preserve that value
    // and sync it back to the model instead of overriding it.
    if (hydrating && hydrateValue !== undefined && hydrateValue !== newValue) {
      const castToNumber =
        number || (vnode.props && vnode.props.type === 'number')
      el[assignKey] &&
        el[assignKey](castValue(hydrateValue, trim, castToNumber))
      return
    }
    el.value = newValue
  },
  beforeUpdate(
    el,
    { value, oldValue, modifiers: { lazy, trim, number } },
    vnode,
  ) {
    el[assignKey] = getModelAssigner(vnode)
    // avoid clearing unresolved text. #2302
    if ((el as any).composing) return
    const elValue =
      (number || el.type === 'number') && !/^0\d/.test(el.value)
        ? looseToNumber(el.value)
        : el.value
    const newValue = value == null ? '' : value

    if (elValue === newValue) {
      return
    }

    if (document.activeElement === el && el.type !== 'range') {
      // #8546
      if (lazy && value === oldValue) {
        return
      }
      if (trim && el.value.trim() === newValue) {
        return
      }
    }

    el.value = newValue
  },
}

export const vModelCheckbox: ModelDirective<HTMLInputElement> = {
  // #4096 array checkboxes need to be deep traversed
  deep: true,
  created(el, _, vnode, _prev, hydrating) {
    el[hydratingKey] = hydrating
    el[assignKey] = getModelAssigner(vnode)
    addEventListener(el, 'change', () => {
      const modelValue = (el as any)._modelValue
      const elementValue = getValue(el)
      const checked = el.checked
      const assign = el[assignKey]
      setCheckboxValue(assign, modelValue, elementValue, checked, el)
    })
  },
  // set initial checked on mount to wait for true-value/false-value
  mounted(el, binding, vnode) {
    const hydrating = el[hydratingKey]
    delete el[hydratingKey]
    setChecked(el, binding, vnode, hydrating)
  },
  beforeUpdate(el, binding, vnode) {
    el[assignKey] = getModelAssigner(vnode)
    setChecked(el, binding, vnode)
  },
}

function setChecked(
  el: HTMLInputElement & { [assignKey]?: AssignerFn; _modelValue?: any },
  { value, oldValue }: DirectiveBinding,
  vnode: VNode,
  hydrating?: boolean,
) {
  // store the v-model value on the element so it can be accessed by the
  // change listener.
  el._modelValue = value
  let checked: boolean

  if (isArray(value)) {
    checked = looseIndexOf(value, vnode.props!.value) > -1
  } else if (isSet(value)) {
    checked = value.has(vnode.props!.value)
  } else {
    if (value === oldValue) return
    checked = looseEqual(value, getCheckboxValue(el, true))
  }

  if (hydrating && el.checked !== checked) {
    const assign = el[assignKey]
    if (assign) {
      setCheckboxValue(assign, value, getValue(el), el.checked, el)
      return
    }
  }

  // Only update if the checked state has changed
  if (el.checked !== checked) {
    el.checked = checked
  }
}

export const vModelRadio: ModelDirective<HTMLInputElement> = {
  created(el, { value }, vnode, _prev, hydrating) {
    el[hydratingKey] = hydrating
    el[assignKey] = getModelAssigner(vnode)
    const checked = looseEqual(value, vnode.props!.value)
    if (hydrating && el.checked !== checked) {
      if (el.checked) {
        el[assignKey](vnode.props!.value)
      }
    } else {
      el.checked = checked
    }
    delete el[hydratingKey]
    addEventListener(el, 'change', () => {
      el[assignKey](getValue(el))
    })
  },
  beforeUpdate(el, { value, oldValue }, vnode) {
    el[assignKey] = getModelAssigner(vnode)
    if (value !== oldValue) {
      el.checked = looseEqual(value, vnode.props!.value)
    }
  },
}

export const vModelSelect: ModelDirective<HTMLSelectElement, 'number'> = {
  // <select multiple> value need to be deep traversed
  deep: true,
  created(el, { value, modifiers: { number } }, vnode, _prev, hydrating) {
    el[hydratingKey] = hydrating
    if (hydrating) {
      el[hydrationSelectKey] = getSelectedValue(el, number, isSet(value))
    }
    const isSetModel = isSet(value)
    addEventListener(el, 'change', () => {
      el[assignKey](getSelectedValue(el, number, isSetModel))
      el._assigning = true
      nextTick(() => {
        el._assigning = false
      })
    })
    el[assignKey] = getModelAssigner(vnode)
  },
  // set value in mounted & updated because <select> relies on its children
  // <option>s.
  mounted(el, { value, modifiers: { number } }) {
    const hydrating = el[hydratingKey]
    delete el[hydratingKey]
    const hydrateValue = el[hydrationSelectKey]
    if (hydrateValue !== undefined) {
      delete el[hydrationSelectKey]
    }
    if (hydrating) {
      const selectedValue =
        hydrateValue !== undefined
          ? hydrateValue
          : getSelectedValue(el, number, isSet(value))
      if (!isSelectValueEqual(selectedValue, value)) {
        el[assignKey] && el[assignKey](selectedValue)
        return
      }
    }
    setSelected(el, value)
  },
  beforeUpdate(el, _binding, vnode) {
    el[assignKey] = getModelAssigner(vnode)
  },
  updated(el, { value }) {
    if (!el._assigning) {
      setSelected(el, value)
    }
  },
}

function setSelected(el: HTMLSelectElement, value: any) {
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
    const optionValue = getValue(option)
    if (isMultiple) {
      if (isArrayValue) {
        const optionType = typeof optionValue
        // fast path for string / number values
        if (optionType === 'string' || optionType === 'number') {
          option.selected = value.some(v => String(v) === String(optionValue))
        } else {
          option.selected = looseIndexOf(value, optionValue) > -1
        }
      } else {
        option.selected = value.has(optionValue)
      }
    } else if (looseEqual(getValue(option), value)) {
      if (el.selectedIndex !== i) el.selectedIndex = i
      return
    }
  }
  if (!isMultiple && el.selectedIndex !== -1) {
    el.selectedIndex = -1
  }
}

function getSelectedValue(
  el: HTMLSelectElement,
  number: boolean | undefined,
  isSetModel: boolean,
) {
  const selectedVal = Array.prototype.filter
    .call(el.options, (o: HTMLOptionElement) => o.selected)
    .map((o: HTMLOptionElement) =>
      number ? looseToNumber(getValue(o)) : getValue(o),
    )
  return el.multiple
    ? isSetModel
      ? new Set(selectedVal)
      : selectedVal
    : selectedVal[0]
}

function isSelectValueEqual(a: any, b: any) {
  if (isSet(a) && isSet(b)) {
    if (a.size !== b.size) return false
    for (const value of a) {
      if (!b.has(value)) {
        return false
      }
    }
    return true
  }
  return looseEqual(a, b)
}

function setCheckboxValue(
  assign: AssignerFn,
  modelValue: any,
  elementValue: any,
  checked: boolean,
  el: HTMLInputElement & { _trueValue?: any; _falseValue?: any },
) {
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
  } else if (isSet(modelValue)) {
    const cloned = new Set(modelValue)
    if (checked) {
      cloned.add(elementValue)
    } else {
      cloned.delete(elementValue)
    }
    assign(cloned)
  } else {
    assign(getCheckboxValue(el, checked))
  }
}

// retrieve raw value set via :value bindings
function getValue(el: HTMLOptionElement | HTMLInputElement) {
  return '_value' in el ? (el as any)._value : el.value
}

// retrieve raw value for true-value and false-value set via :true-value or :false-value bindings
function getCheckboxValue(
  el: HTMLInputElement & { _trueValue?: any; _falseValue?: any },
  checked: boolean,
) {
  const key = checked ? '_trueValue' : '_falseValue'
  return key in el ? el[key] : checked
}

export const vModelDynamic: ObjectDirective<
  HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
> = {
  created(el, binding, vnode, _prev, hydrating) {
    callModelHook(el, binding, vnode, null, 'created', hydrating)
  },
  mounted(el, binding, vnode, _prev, hydrating) {
    callModelHook(el, binding, vnode, null, 'mounted', hydrating)
  },
  beforeUpdate(el, binding, vnode, prevVNode) {
    callModelHook(el, binding, vnode, prevVNode, 'beforeUpdate')
  },
  updated(el, binding, vnode, prevVNode) {
    callModelHook(el, binding, vnode, prevVNode, 'updated')
  },
}

function resolveDynamicModel(tagName: string, type: string | undefined) {
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
  vnode: VNode,
  prevVNode: VNode | null,
  hook: keyof ObjectDirective,
  hydrating?: boolean,
) {
  const modelToUse = resolveDynamicModel(
    el.tagName,
    vnode.props && vnode.props.type,
  )
  const fn = modelToUse[hook] as DirectiveHook
  fn && fn(el, binding, vnode, prevVNode, hydrating)
}

// SSR vnode transforms, only used when user includes client-oriented render
// function in SSR
export function initVModelForSSR(): void {
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
    } else if (isSet(value)) {
      if (vnode.props && value.has(vnode.props.value)) {
        return { checked: true }
      }
    } else if (value) {
      return { checked: true }
    }
  }

  vModelDynamic.getSSRProps = (binding, vnode) => {
    if (typeof vnode.type !== 'string') {
      return
    }
    const modelToUse = resolveDynamicModel(
      // resolveDynamicModel expects an uppercase tag name, but vnode.type is lowercase
      vnode.type.toUpperCase(),
      vnode.props && vnode.props.type,
    )
    if (modelToUse.getSSRProps) {
      return modelToUse.getSSRProps(binding, vnode)
    }
  }
}

export type VModelDirective =
  | typeof vModelText
  | typeof vModelCheckbox
  | typeof vModelSelect
  | typeof vModelRadio
  | typeof vModelDynamic
