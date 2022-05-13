import {
  getCurrentInstance,
  DeprecationTypes,
  LegacyConfig,
  compatUtils,
  ComponentInternalInstance
} from '@vue/runtime-core'
import { hyphenate, isArray } from '@vue/shared'

const systemModifiers = ['ctrl', 'shift', 'alt', 'meta']

type KeyedEvent = KeyboardEvent | MouseEvent | TouchEvent

const modifierGuards: Record<
  string,
  (e: Event, modifiers: string[]) => void | boolean
> = {
  stop: e => e.stopPropagation(),
  prevent: e => e.preventDefault(),
  self: e => e.target !== e.currentTarget,
  ctrl: e => !(e as KeyedEvent).ctrlKey,
  shift: e => !(e as KeyedEvent).shiftKey,
  alt: e => !(e as KeyedEvent).altKey,
  meta: e => !(e as KeyedEvent).metaKey,
  left: e => 'button' in e && (e as MouseEvent).button !== 0,
  middle: e => 'button' in e && (e as MouseEvent).button !== 1,
  right: e => 'button' in e && (e as MouseEvent).button !== 2,
  exact: (e, modifiers) =>
    systemModifiers.some(m => (e as any)[`${m}Key`] && !modifiers.includes(m))
}

/**
 * @private
 */
export const withModifiers = (fn: Function, modifiers: string[]) => {
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
const keyNames: Record<string, string | string[]> = {
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
    if (modifiers.some(k => k === eventKey || keyNames[k] === eventKey)) {
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
