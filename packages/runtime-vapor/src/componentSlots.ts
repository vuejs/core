import { EMPTY_OBJ, NO, hasOwn, isArray, isFunction } from '@vue/shared'
import { type Block, type BlockFn, DynamicFragment } from './block'
import {
  type RawProps,
  getAttrFromRawProps,
  getKeysFromRawProps,
  hasAttrFromRawProps,
} from './componentProps'
import { currentInstance } from '@vue/runtime-core'
import type { LooseRawProps, VaporComponentInstance } from './component'
import { renderEffect } from './renderEffect'

export type RawSlots = Record<string, Slot> & {
  $?: DynamicSlotSource[]
}

export type StaticSlots = Record<string, Slot>

export type Slot = BlockFn
export type DynamicSlot = { name: string; fn: Slot }
export type DynamicSlotFn = () => DynamicSlot | DynamicSlot[]
export type DynamicSlotSource = StaticSlots | DynamicSlotFn

export const dynamicSlotsProxyHandlers: ProxyHandler<RawSlots> = {
  get: getSlot,
  has: (target, key: string) => !!getSlot(target, key),
  getOwnPropertyDescriptor(target, key: string) {
    const slot = getSlot(target, key)
    if (slot) {
      return {
        configurable: true,
        enumerable: true,
        value: slot,
      }
    }
  },
  ownKeys(target) {
    let keys = Object.keys(target)
    const dynamicSources = target.$
    if (dynamicSources) {
      keys = keys.filter(k => k !== '$')
      for (const source of dynamicSources) {
        if (isFunction(source)) {
          const slot = source()
          if (isArray(slot)) {
            for (const s of slot) keys.push(String(s.name))
          } else {
            keys.push(String(slot.name))
          }
        } else {
          keys.push(...Object.keys(source))
        }
      }
    }
    return keys
  },
  set: NO,
  deleteProperty: NO,
}

export function getSlot(
  target: RawSlots,
  key: string,
): (Slot & { _bound?: Slot }) | undefined {
  if (key === '$') return
  const dynamicSources = target.$
  if (dynamicSources) {
    let i = dynamicSources.length
    let source
    while (i--) {
      source = dynamicSources[i]
      if (isFunction(source)) {
        const slot = source()
        if (slot) {
          if (isArray(slot)) {
            for (const s of slot) {
              if (String(s.name) === key) return s.fn
            }
          } else if (String(slot.name) === key) {
            return slot.fn
          }
        }
      } else if (hasOwn(source, key)) {
        return source[key]
      }
    }
  }
  if (hasOwn(target, key)) {
    return target[key]
  }
}

const dynamicSlotsPropsProxyHandlers: ProxyHandler<RawProps> = {
  get: getAttrFromRawProps,
  has: hasAttrFromRawProps,
  ownKeys: getKeysFromRawProps,
  getOwnPropertyDescriptor(target, key: string) {
    if (hasAttrFromRawProps(target, key)) {
      return {
        configurable: true,
        enumerable: true,
        get: () => getAttrFromRawProps(target, key),
      }
    }
  },
}

// TODO how to handle empty slot return blocks?
// e.g. a slot renders a v-if node that may toggle inside.
// we may need special handling by passing the fallback into the slot
// and make the v-if use it as fallback
export function createSlot(
  name: string | (() => string),
  rawProps?: LooseRawProps | null,
  fallback?: Slot,
): Block {
  const instance = currentInstance as VaporComponentInstance
  const rawSlots = instance.rawSlots
  const isDynamicName = isFunction(name)
  const fragment = __DEV__ ? new DynamicFragment('slot') : new DynamicFragment()
  const slotProps = rawProps
    ? new Proxy(rawProps, dynamicSlotsPropsProxyHandlers)
    : EMPTY_OBJ

  const renderSlot = () => {
    const slot = getSlot(rawSlots, isFunction(name) ? name() : name)
    if (slot) {
      // create and cache bound version of the slot to make it stable
      // so that we avoid unnecessary updates if it resolves to the same slot
      fragment.update(
        slot._bound ||
          (slot._bound = () => {
            const slotContent = slot(slotProps)
            if (slotContent instanceof DynamicFragment) {
              slotContent.fallback = fallback
            }
            return slotContent
          }),
      )
    } else {
      fragment.update(fallback)
    }
  }

  // dynamic slot name or has dynamicSlots
  if (isDynamicName || rawSlots.$) {
    renderEffect(renderSlot)
  } else {
    renderSlot()
  }

  return fragment
}
