import { EMPTY_OBJ, NO, hasOwn, isArray, isFunction } from '@vue/shared'
import { type Block, type BlockRenderFn, DynamicFragment } from './block'
import type { RawProps } from './componentProps'
import { currentInstance } from '@vue/runtime-core'
import type { VaporComponentInstance } from './component'
import { renderEffect } from './renderEffect'

export type RawSlots = Record<string, Slot> & {
  $?: (StaticSlots | DynamicSlotFn)[]
}

export type StaticSlots = Record<string, Slot>

export type Slot = BlockRenderFn
export type DynamicSlot = { name: string; fn: Slot }
export type DynamicSlotFn = () => DynamicSlot | DynamicSlot[]

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
    const keys = Object.keys(target)
    const dynamicSources = target.$
    if (dynamicSources) {
      for (const source of dynamicSources) {
        if (isFunction(source)) {
          const slot = source()
          if (isArray(slot)) {
            for (const s of slot) keys.push(s.name)
          } else {
            keys.push(slot.name)
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

export function getSlot(target: RawSlots, key: string): Slot | undefined {
  if (key === '$') return
  const dynamicSources = target.$
  if (dynamicSources) {
    let i = dynamicSources.length
    let source
    while (i--) {
      source = dynamicSources[i]
      if (isFunction(source)) {
        const slot = source()
        if (isArray(slot)) {
          for (const s of slot) {
            if (s.name === key) return s.fn
          }
        } else if (slot.name === key) {
          return slot.fn
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

// TODO
const dynamicSlotsPropsProxyHandlers: ProxyHandler<RawProps> = {
  get(target, key: string) {
    return target[key]
  },
  has(target, key) {
    return key in target
  },
}

// TODO how to handle empty slot return blocks?
// e.g. a slot renders a v-if node that may toggle inside.
// we may need special handling by passing the fallback into the slot
// and make the v-if use it as fallback
export function createSlot(
  name: string | (() => string),
  rawProps?: RawProps,
  fallback?: Slot,
): Block {
  const rawSlots = (currentInstance as VaporComponentInstance)!.rawSlots
  const resolveSlot = () => getSlot(rawSlots, isFunction(name) ? name() : name)
  const slotProps = rawProps
    ? rawProps.$
      ? new Proxy(rawProps, dynamicSlotsPropsProxyHandlers)
      : rawProps
    : EMPTY_OBJ

  if (isFunction(name) || rawSlots.$) {
    // dynamic slot name, or dynamic slot sources
    const fragment = new DynamicFragment('slot')
    renderEffect(() => {
      const slot = resolveSlot()
      if (slot) {
        fragment.update(
          () => slot(slotProps) || (fallback && fallback()),
          // pass the stable slot fn as key to avoid toggling when resolving
          // to the same slot
          slot,
        )
      } else {
        fragment.update(fallback)
      }
    })
    return fragment
  } else {
    // static
    const slot = resolveSlot()
    if (slot) {
      const block = slot(slotProps)
      if (block) return block
    }
    return fallback ? fallback() : []
  }
}
