import {
  invokeArrayFns,
  isArray,
  isSet,
  looseEqual,
  looseIndexOf,
  looseToNumber,
} from '@vue/shared'
import type { ComponentInternalInstance } from '../component'
import type { ObjectDirective } from '../directive'
import { on } from '../dom/on'
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
    on(el, lazy ? 'change' : 'input', e => {
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
      on(el, 'change', () => {
        el.value = el.value.trim()
      })
    }
    if (!lazy) {
      on(el, 'compositionstart', onCompositionStart)
      on(el, 'compositionend', onCompositionEnd)
      // Safari < 10.2 & UIWebView doesn't fire compositionend when
      // switching focus before confirming composition choice
      // this also fixes the issue where some browsers e.g. iOS Chrome
      // fires "change" instead of "input" on autocomplete.
      on(el, 'change', onCompositionEnd)
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
  beforeMount(
    el,
    { value, oldValue, instance, modifiers: { number = false } = {} },
  ) {
    const isSetModel = isSet(value)
    on(el, 'change', () => {
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
    setSelected(el, instance, value, oldValue, number)
  },
  beforeUpdate(el, { instance }) {
    assignFnMap.set(el, getModelAssigner(el, instance))
  },
  updated(
    el,
    { value, oldValue, instance, modifiers: { number = false } = {} },
  ) {
    if (!assigningMap.get(el)) {
      setSelected(el, instance, value, oldValue, number)
    }
  },
}

function setSelected(
  el: HTMLSelectElement,
  instance: ComponentInternalInstance,
  value: any,
  oldValue: any,
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

  // Disable fast path due to https://github.com/vuejs/core/issues/10267
  // fast path for updates triggered by other changes
  // if (isArrayValue && looseEqual(value, oldValue)) {
  //   return
  // }

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
  return metadata ? metadata.props.value : el.value
}

export const vModelCheckbox = {}

export const vModelDynamic = {}
