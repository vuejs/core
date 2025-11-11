import { EMPTY_OBJ, NO, hasOwn, isArray, isFunction } from '@vue/shared'
import { type Block, type BlockFn, insert, setScopeId } from './block'
import { rawPropsProxyHandlers } from './componentProps'
import {
  type GenericComponentInstance,
  currentInstance,
  isAsyncWrapper,
  isRef,
  setCurrentInstance,
} from '@vue/runtime-dom'
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
import { createElement } from './dom/node'
import { setDynamicProps } from './dom/prop'

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

// Tracks slot execution context: the owner that defined the slot, and the
// consumer that is currently rendering it.
const slotOwnerStack: (VaporComponentInstance | null)[] = []
const slotConsumerStack: (VaporComponentInstance | null)[] = []

export function getSlotOwner(): VaporComponentInstance | null {
  return slotOwnerStack.length > 0
    ? slotOwnerStack[slotOwnerStack.length - 1]
    : null
}

export function getSlotConsumer(): VaporComponentInstance | null {
  return slotConsumerStack.length > 0
    ? slotConsumerStack[slotConsumerStack.length - 1]
    : null
}

export function withVaporCtx(fn: Function): BlockFn {
  const ownerInstance = currentInstance as VaporComponentInstance | null
  return (...args: any[]) => {
    const prev = setCurrentInstance(ownerInstance)
    slotOwnerStack.push(ownerInstance)
    slotConsumerStack.push(prev[0] as VaporComponentInstance | null)
    try {
      return fn(...args)
    } finally {
      slotConsumerStack.pop()
      slotOwnerStack.pop()
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

  const consumer = currentInstance as VaporComponentInstance
  const owner = getSlotOwner() || consumer
  const rawSlots = consumer!.rawSlots
  const slotProps = rawProps
    ? new Proxy(rawProps, rawPropsProxyHandlers)
    : EMPTY_OBJ

  let fragment: DynamicFragment
  if (isRef(rawSlots._)) {
    if (isHydrating) locateHydrationNode()
    fragment = owner.appContext.vapor!.vdomSlot(
      rawSlots._,
      name,
      slotProps,
      owner,
      fallback,
    )
  } else {
    fragment =
      isHydrating || __DEV__
        ? new DynamicFragment('slot')
        : new DynamicFragment()
    const isDynamicName = isFunction(name)

    const slotScopeIds: string[] = []
    if (!noSlotted) {
      const scopeId = owner.type.__scopeId
      if (scopeId) {
        slotScopeIds.push(`${scopeId}-s`)
      }
    }

    const renderSlot = () => {
      const slotName = isFunction(name) ? name() : name

      if (
        (consumer as GenericComponentInstance).ce ||
        (consumer.parent &&
          isAsyncWrapper(consumer.parent) &&
          consumer.parent.ce)
      ) {
        const el = createElement('slot')
        renderEffect(() => {
          setDynamicProps(el, [
            slotProps,
            slotName !== 'default' ? { name: slotName } : {},
          ])
        })
        if (fallback) insert(fallback(), el)
        fragment.nodes = el
        return
      }

      const slot = getSlot(rawSlots, slotName)
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
      const scopeId = owner.type.__scopeId
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
