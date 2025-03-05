import { EMPTY_OBJ, NO, hasOwn, isArray, isFunction } from '@vue/shared'
import { type Block, type BlockFn, DynamicFragment } from './block'
import { rawPropsProxyHandlers } from './componentProps'
import { currentInstance, isRef } from '@vue/runtime-dom'
import type { LooseRawProps, VaporComponentInstance } from './component'
import { renderEffect } from './renderEffect'

export type RawSlots = Record<string, VaporSlot> & {
  $?: DynamicSlotSource[]
}

export type StaticSlots = Record<string, VaporSlot>

export type VaporSlot = BlockFn
export type DynamicSlot = { name: string; fn: VaporSlot }
export type DynamicSlotFn = () => DynamicSlot | DynamicSlot[]
export type DynamicSlotSource = StaticSlots | DynamicSlotFn

export const vaporSlotsProxyHandler: ProxyHandler<any> = {
  get(target, key) {
    if (key === '_vapor') {
      return target
    } else {
      return target[key]
    }
  },
}

export const dynamicSlotsProxyHandlers: ProxyHandler<RawSlots> = {
  get: (target, key: string) => {
    if (key === '_vapor') {
      return target
    } else {
      return getSlot(target, key)
    }
  },
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
): (VaporSlot & { _bound?: VaporSlot }) | undefined {
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

export function createSlot(
  name: string | (() => string),
  rawProps?: LooseRawProps | null,
  fallback?: VaporSlot,
): Block {
  const instance = currentInstance as VaporComponentInstance
  const rawSlots = instance.rawSlots
  const slotProps = rawProps
    ? new Proxy(rawProps, rawPropsProxyHandlers)
    : EMPTY_OBJ

  if (isRef(rawSlots._)) {
    return instance.appContext.vapor!.vdomSlot(
      rawSlots._,
      name,
      slotProps,
      instance,
      fallback,
    )
  }

  const isDynamicName = isFunction(name)
  const fragment = __DEV__ ? new DynamicFragment('slot') : new DynamicFragment()
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
