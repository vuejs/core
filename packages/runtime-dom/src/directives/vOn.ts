import {
  type ComponentInternalInstance,
  DeprecationTypes,
  type Directive,
  type LegacyConfig,
  compatUtils,
  getCurrentInstance,
} from '@vue/runtime-core'
import { hyphenate, isArray } from '@vue/shared'

const systemModifiers = ['ctrl', 'shift', 'alt', 'meta'] as const
type SystemModifiers = (typeof systemModifiers)[number]
type CompatModifiers = keyof typeof keyNames

export type VOnModifiers = SystemModifiers | ModifierGuards | CompatModifiers
type KeyedEvent = KeyboardEvent | MouseEvent | TouchEvent

type ModifierGuards =
  | 'shift'
  | 'ctrl'
  | 'alt'
  | 'meta'
  | 'left'
  | 'right'
  | 'stop'
  | 'prevent'
  | 'self'
  | 'middle'
  | 'exact'
const modifierGuards: Record<
  ModifierGuards,
  | ((e: Event) => void | boolean)
  | ((e: Event, modifiers: string[]) => void | boolean)
> = {
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
  exact: (e, modifiers) =>
    systemModifiers.some(m => (e as any)[`${m}Key`] && !modifiers.includes(m)),
}

/**
 * @private
 */
export const withModifiers = <
  T extends (event: Event, ...args: unknown[]) => any,
>(
  fn: T & { _withMods?: { [key: string]: T } },
  modifiers: VOnModifiers[],
): T => {
  const cache = fn._withMods || (fn._withMods = {})
  const cacheKey = modifiers.join('.')
  return (
    cache[cacheKey] ||
    (cache[cacheKey] = ((event, ...args) => {
      for (let i = 0; i < modifiers.length; i++) {
        const guard = modifierGuards[modifiers[i] as ModifierGuards]
        if (guard && guard(event, modifiers)) return
      }
      return fn(event, ...args)
    }) as T)
  )
}

// Kept for 2.x compat.
// Note: IE11 compat for `spacebar` and `del` is removed for now.
const keyNames: Record<
  'esc' | 'space' | 'up' | 'left' | 'right' | 'down' | 'delete',
  string
> = {
  esc: 'escape',
  space: ' ',
  up: 'arrow-up',
  left: 'arrow-left',
  right: 'arrow-right',
  down: 'arrow-down',
  delete: 'backspace',
}

/**
 * @private
 */
export const withKeys = <T extends (event: KeyboardEvent) => any>(
  fn: T & { _withKeys?: { [k: string]: T } },
  modifiers: string[],
): T => {
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
        instance,
      )
    }
  }

  const cache: { [k: string]: T } = fn._withKeys || (fn._withKeys = {})
  const cacheKey = modifiers.join('.')

  return (
    cache[cacheKey] ||
    (cache[cacheKey] = (event => {
      if (!('key' in event)) {
        return
      }

      const eventKey = hyphenate(event.key)
      if (
        modifiers.some(
          k =>
            k === eventKey ||
            keyNames[k as unknown as CompatModifiers] === eventKey,
        )
      ) {
        return fn(event)
      }

      if (__COMPAT__) {
        const keyCode = String(event.keyCode)
        if (
          compatUtils.isCompatEnabled(
            DeprecationTypes.V_ON_KEYCODE_MODIFIER,
            instance,
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
    }) as T)
  )
}

export type VOnDirective = Directive<any, any, VOnModifiers>
