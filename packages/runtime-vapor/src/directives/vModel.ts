import type { ComponentInternalInstance } from '../component'
import type { ObjectDirective } from '../directive'
import { on } from '../dom/on'
import { invokeArrayFns, isArray, looseToNumber } from '@vue/shared'

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

const assignKeyMap = new WeakMap<HTMLElement, AssignerFn>()

// We are exporting the v-model runtime directly as vnode hooks so that it can
// be tree-shaken in case v-model is never used.
export const vModelText: ObjectDirective<
  HTMLInputElement | HTMLTextAreaElement
> = {
  beforeMount(el, { instance, modifiers: { lazy, trim, number } = {} }) {
    const assigner = getModelAssigner(el, instance)
    assignKeyMap.set(el, assigner)

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
    assignKeyMap.set(el, getModelAssigner(el, instance))

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
