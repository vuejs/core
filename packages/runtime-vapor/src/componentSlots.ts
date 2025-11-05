import { EMPTY_OBJ, NO, hasOwn, isArray, isFunction } from '@vue/shared'
import { type Block, type BlockFn, insert, setScopeId } from './block'
import { rawPropsProxyHandlers } from './componentProps'
import { currentInstance, isRef, setCurrentInstance } from '@vue/runtime-dom'
import type { LooseRawProps, VaporComponentInstance } from './component'
import { renderEffect } from './renderEffect'
import {
  insertionAnchor,
  insertionParent,
  isLastInsertion,
  resetInsertionState,
} from './insertionState'
import {
  advanceHydrationNode,
  isHydrating,
  locateHydrationNode,
} from './dom/hydration'
import { DynamicFragment, type VaporFragment } from './fragment'

/**
 * Current slot scopeIds for vdom interop
 * @internal
 */
export let currentSlotScopeIds: string[] | null = null

/**
 * @internal
 */
export function setCurrentSlotScopeIds(
  scopeIds: string[] | null,
): string[] | null {
  const prev = currentSlotScopeIds
  currentSlotScopeIds = scopeIds
  return prev
}

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

/**
 * Wraps a slot function to execute in the parent component's context.
 *
 * This ensures that:
 * 1. Reactive effects created inside the slot (e.g., `renderEffect`) bind to the
 *    parent's instance, so the parent's lifecycle hooks fire when the slot's
 *    reactive dependencies change.
 * 2. Elements created in the slot inherit the parent's scopeId for proper style
 *    scoping in scoped CSS.
 *
 * **Rationale**: Slots are defined in the parent's template, so the parent should
 * own the rendering context and be aware of updates.
 *
 */
export function withVaporCtx(fn: Function): BlockFn {
  const instance = currentInstance as VaporComponentInstance
  return (...args: any[]) => {
    const prev = setCurrentInstance(instance)
    try {
      return fn(...args)
    } finally {
      setCurrentInstance(...prev)
    }
  }
}

export function createSlot(
  name: string | (() => string),
  rawProps?: LooseRawProps | null,
  fallback?: VaporSlot,
  noSlotted?: boolean,
): Block {
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  const _isLastInsertion = isLastInsertion
  if (!isHydrating) resetInsertionState()

  const instance = currentInstance as VaporComponentInstance
  const rawSlots = instance.rawSlots
  const slotProps = rawProps
    ? new Proxy(rawProps, rawPropsProxyHandlers)
    : EMPTY_OBJ

  let fragment: DynamicFragment
  if (isRef(rawSlots._)) {
    if (isHydrating) locateHydrationNode()
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
        ? new DynamicFragment('slot')
        : new DynamicFragment()
    const isDynamicName = isFunction(name)

    // Calculate slotScopeIds once (for vdom interop)
    const slotScopeIds: string[] = []
    if (!noSlotted) {
      const scopeId = instance!.type.__scopeId
      if (scopeId) {
        slotScopeIds.push(`${scopeId}-s`)
      }
    }

    const renderSlot = () => {
      const slot = getSlot(rawSlots, isFunction(name) ? name() : name)
      if (slot) {
        fragment.fallback = fallback
        // Create and cache bound version of the slot to make it stable
        // so that we avoid unnecessary updates if it resolves to the same slot

        fragment.update(
          slot._bound ||
            (slot._bound = () => {
              const prevSlotScopeIds = setCurrentSlotScopeIds(
                slotScopeIds.length > 0 ? slotScopeIds : null,
              )
              try {
                return slot(slotProps)
              } finally {
                setCurrentSlotScopeIds(prevSlotScopeIds)
              }
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
  }

  if (!isHydrating) {
    if (!noSlotted) {
      const scopeId = instance.type.__scopeId
      if (scopeId) {
        setScopeId(fragment, [`${scopeId}-s`])
      }
    }

    if (_insertionParent) insert(fragment, _insertionParent, _insertionAnchor)
  } else {
    if (fragment.insert) {
      ;(fragment as VaporFragment).hydrate!()
    }
    if (_isLastInsertion) {
      advanceHydrationNode(_insertionParent!)
    }
  }

  return fragment
}
