import {
  getCurrentInstance,
  DeprecationTypes,
  LegacyConfig,
  compatUtils,
  ComponentInternalInstance,
  Directive
} from '@vue/runtime-core'
import { hyphenate, isArray } from '@vue/shared'

type KeyedEvent = KeyboardEvent | MouseEvent | TouchEvent

type SystemModifiers = 'ctrl' | 'shift' | 'alt' | 'meta'
type CompatModifiers = keyof typeof keyNames

export type VOnModifiers = SystemModifiers | ModifierGuards | CompatModifiers

const systemModifiers: Array<SystemModifiers> = ['ctrl', 'shift', 'alt', 'meta']

const modifierGuards = {
  stop: (e: Event) => e.stopPropagation(),
  prevent: (e: Event) => e.preventDefault(),
  self: (e: Event) => e.target !== e.currentTarget,
  ctrl: (e: Event) => !(e as KeyedEvent).ctrlKey,
  shift: (e: Event) => !(e as KeyedEvent).shiftKey,
  alt: (e: Event) => !(e as KeyedEvent).altKey,
  meta: (e: Event) => !(e as KeyedEvent).metaKey,
  left: (e: Event) => 'button' in e && (e as MouseEvent).button !== 0,
  middle: (e: Event) => 'button' in e && (e as MouseEvent).button !== 1,
  right: (e: Event) => 'button' in e && (e as MouseEvent).button !== 2,
  exact: (e: Event, modifiers: string[]) =>
    systemModifiers.some(m => (e as any)[`${m}Key`] && !modifiers.includes(m))
}

type ModifierGuards = keyof typeof modifierGuards

/**
 * @private
 */
export const withModifiers = (
  fn: Function,
  modifiers: Array<ModifierGuards | SystemModifiers>
) => {
  return (event: Event, ...args: unknown[]) => {
    for (let i = 0; i < modifiers.length; i++) {
      const guard = modifierGuards[modifiers[i]]
      if (guard && guard(event, modifiers)) return
    }
    return fn(event, ...args)
  }
}

// Kept for 2.x compat.
// Note: IE11 compat for `spacebar` and `del` is removed for now.
const keyNames = {
  esc: 'escape',
  space: ' ',
  up: 'arrow-up',
  left: 'arrow-left',
  right: 'arrow-right',
  down: 'arrow-down',
  delete: 'backspace'
}

/**
 * @private
 */
export const withKeys = (fn: Function, modifiers: string[]) => {
  let globalKeyCodes: LegacyConfig['keyCodes']
  let instance: ComponentInternalInstance | null = null
  if (__COMPAT__) {
    instance = getCurrentInstance()
    if (
      compatUtils.isCompatEnabled(DeprecationTypes.CONFIG_KEY_CODES, instance)
    ) {
      if (instance) {
        globalKeyCodes = (instance.appContext.config as LegacyConfig).keyCodes
      }
    }
    if (__DEV__ && modifiers.some(m => /^\d+$/.test(m))) {
      compatUtils.warnDeprecation(
        DeprecationTypes.V_ON_KEYCODE_MODIFIER,
        instance
      )
    }
  }

  return (event: KeyboardEvent) => {
    if (!('key' in event)) {
      return
    }

    const eventKey = hyphenate(event.key)
    if (
      modifiers.some(
        k => k === eventKey || keyNames[k as CompatModifiers] === eventKey
      )
    ) {
      return fn(event)
    }

    if (__COMPAT__) {
      const keyCode = String(event.keyCode)
      if (
        compatUtils.isCompatEnabled(
          DeprecationTypes.V_ON_KEYCODE_MODIFIER,
          instance
        ) &&
        modifiers.some(mod => mod == keyCode)
      ) {
        return fn(event)
      }
      if (globalKeyCodes) {
        for (const mod of modifiers) {
          const codes = globalKeyCodes[mod]
          if (codes) {
            const matches = isArray(codes)
              ? codes.some(code => String(code) === keyCode)
              : String(codes) === keyCode
            if (matches) {
              return fn(event)
            }
          }
        }
      }
    }
  }
}

export type VOnDirective = Directive<any, any, VOnModifiers>
