import { NO, hasOwn, isArray, isFunction } from '@vue/shared'
import { type Block, Fragment, isValidBlock } from './block'
import { type RawProps, resolveDynamicProps } from './componentProps'
import { currentInstance } from '@vue/runtime-core'
import type { VaporComponentInstance } from './component'

export type RawSlots = Record<string, Slot> & {
  $?: (StaticSlots | DynamicSlotFn)[]
}

export type StaticSlots = Record<string, Slot>

export type Slot = (...args: any[]) => Block
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

export function createSlot(
  name: string | (() => string),
  props?: RawProps,
  fallback?: Slot,
): Block {
  const slots = (currentInstance as VaporComponentInstance)!.rawSlots
  if (isFunction(name) || slots.$) {
    // dynamic slot name, or dynamic slot sources
    // TODO togglable fragment class
    const fragment = new Fragment([], 'slot')
    return fragment
  } else {
    // static
    return renderSlot(name)
  }

  function renderSlot(name: string) {
    const slot = getSlot(slots, name)
    if (slot) {
      const block = slot(props ? resolveDynamicProps(props) : {})
      if (isValidBlock(block)) {
        return block
      }
    }
    return fallback ? fallback() : []
  }
}
