import {
  EMPTY_OBJ,
  NO,
  SLOT_ANCHOR_LABEL,
  hasOwn,
  isArray,
  isFunction,
} from '@vue/shared'
import { type Block, type BlockFn, insert, setScopeId } from './block'
import { rawPropsProxyHandlers } from './componentProps'
import { currentInstance, isRef } from '@vue/runtime-dom'
import type { LooseRawProps, VaporComponentInstance } from './component'
import { renderEffect } from './renderEffect'
import {
  insertionAnchor,
  insertionParent,
  resetInsertionState,
} from './insertionState'
import { advanceHydrationNode, isHydrating } from './dom/hydration'
import { DynamicFragment } from './fragment'

export type RawSlots = Record<string, VaporSlot> & {
  $?: DynamicSlotSource[]
}

export type StaticSlots = Record<string, VaporSlot>

export type VaporSlot = BlockFn
export type DynamicSlot = { name: string; fn: VaporSlot }
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

export function forwardedSlotCreator(): (
  name: string | (() => string),
  rawProps?: LooseRawProps | null,
  fallback?: VaporSlot,
) => Block {
  const instance = currentInstance as VaporComponentInstance
  return (name, rawProps, fallback) =>
    createSlot(name, rawProps, fallback, instance)
}

export function createSlot(
  name: string | (() => string),
  rawProps?: LooseRawProps | null,
  fallback?: VaporSlot,
  i?: VaporComponentInstance,
): Block {
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  if (!isHydrating) resetInsertionState()

  const instance = i || (currentInstance as VaporComponentInstance)
  const rawSlots = instance.rawSlots
  const slotProps = rawProps
    ? new Proxy(rawProps, rawPropsProxyHandlers)
    : EMPTY_OBJ

  let fragment: DynamicFragment
  if (isRef(rawSlots._)) {
    fragment = instance.appContext.vapor!.vdomSlot(
      rawSlots._,
      name,
      slotProps,
      instance,
      fallback,
    )
  } else {
    fragment =
      isHydrating || __DEV__
        ? new DynamicFragment(SLOT_ANCHOR_LABEL)
        : new DynamicFragment()
    const isDynamicName = isFunction(name)
    const renderSlot = () => {
      const slot = getSlot(rawSlots, isFunction(name) ? name() : name)
      if (slot) {
        fragment.fallback = fallback
        // create and cache bound version of the slot to make it stable
        // so that we avoid unnecessary updates if it resolves to the same slot
        fragment.update(slot._bound || (slot._bound = () => slot(slotProps)))
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
  }

  if (i) fragment.forwarded = true
  if (i || !hasForwardedSlot(fragment.nodes)) {
    const scopeId = instance!.type.__scopeId
    if (scopeId) setScopeId(fragment, `${scopeId}-s`)
  }

  if (
    _insertionParent &&
    (!isHydrating ||
      // for vdom interop fragment, `fragment.insert` handles both hydration and mounting
      fragment.insert)
  ) {
    insert(fragment, _insertionParent, _insertionAnchor)
  }

  if (isHydrating && _insertionAnchor !== undefined) {
    advanceHydrationNode(_insertionParent!)
  }

  return fragment
}

function isForwardedSlot(block: Block): block is DynamicFragment {
  return (
    block instanceof DynamicFragment && !!(block as DynamicFragment).forwarded
  )
}

function hasForwardedSlot(block: Block): block is DynamicFragment {
  if (isArray(block)) {
    return block.some(isForwardedSlot)
  } else {
    return isForwardedSlot(block)
  }
}
