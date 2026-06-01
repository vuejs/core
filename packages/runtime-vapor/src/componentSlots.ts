import {
  EMPTY_OBJ,
  NO,
  VaporSlotFlags,
  hasOwn,
  isArray,
  isFunction,
} from '@vue/shared'
import { type Block, type BlockFn, insert } from './block'
import {
  type RawProps,
  rawPropsProxyHandlers,
  resolveFunctionSource,
  snapshotRawProps,
} from './componentProps'
import {
  type GenericComponentInstance,
  currentInstance,
  isAsyncWrapper,
  isRef,
} from '@vue/runtime-dom'
import type { LooseRawProps, VaporComponentInstance } from './component'
import { renderEffect } from './renderEffect'
import {
  insertionAnchor,
  insertionParent,
  resetInsertionState,
} from './insertionState'
import {
  type HydrationCursor,
  captureHydrationCursor,
  enterHydrationCursor,
  exitHydrationCursor,
  isHydrating,
} from './dom/hydration'
import {
  SlotFragment,
  type VaporFragment,
  withOwnedSlotBoundary,
} from './fragment'
import { createElement } from './dom/node'
import { setDynamicProps } from './dom/prop'
import {
  isCollectingVdomSlotVNodes,
  isInteropEnabled,
} from './vdomInteropState'
import { setScopeId } from './scopeId'

/**
 * Flag to indicate if we are executing a once slot.
 * When true, renderEffect should skip creating reactive effect.
 */
export let inOnceSlot = false

export function withOnceSlot<T>(fn: () => T, value = true): T {
  const prev = inOnceSlot
  try {
    inOnceSlot = value
    return fn()
  } finally {
    inOnceSlot = prev
  }
}

/**
 * Current slot scopeIds for vdom interop
 */
export let currentSlotScopeIds: string[] | null = null

function setCurrentSlotScopeIds(scopeIds: string[] | null): string[] | null {
  try {
    return currentSlotScopeIds
  } finally {
    currentSlotScopeIds = scopeIds
  }
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
          const slot = resolveFunctionSource(source)
          if (slot) {
            if (isArray(slot)) {
              for (const s of slot) keys.push(String(s.name))
            } else {
              keys.push(String(slot.name))
            }
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

export function getSlot(target: RawSlots, key: string): VaporSlot | undefined {
  if (key === '$') return
  const dynamicSources = target.$
  if (dynamicSources) {
    let i = dynamicSources.length
    let source
    while (i--) {
      source = dynamicSources[i]
      if (isFunction(source)) {
        const slot = resolveFunctionSource(source)
        if (slot) {
          if (isArray(slot)) {
            for (let j = slot.length - 1; j >= 0; j--) {
              if (String(slot[j].name) === key) return slot[j].fn
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
 * Tracks the slot owner (the component that defines the slot content).
 * This is used for:
 * 1. Getting the correct rawSlots in forwarded slots (via createSlot)
 * 2. Inheriting the slot owner's scopeId
 */
export let currentSlotOwner: VaporComponentInstance | null = null

export function setCurrentSlotOwner(
  owner: VaporComponentInstance | null,
): VaporComponentInstance | null {
  try {
    return currentSlotOwner
  } finally {
    currentSlotOwner = owner
  }
}

/**
 * Get the effective slot instance for accessing rawSlots and scopeId.
 * Prefers currentSlotOwner (if inside a slot), falls back to currentInstance.
 */
export function getScopeOwner(): VaporComponentInstance | null {
  return (currentSlotOwner || currentInstance) as VaporComponentInstance | null
}

/**
 * Wrap a slot function to track the slot owner.
 *
 * This ensures:
 * 1. createSlot gets rawSlots from the correct instance (slot owner)
 * 2. elements inherit the slot owner's scopeId
 */
export function withVaporCtx(fn: Function): BlockFn {
  const owner = getScopeOwner()
  return (...args: any[]) => {
    const prevOwner = setCurrentSlotOwner(owner)
    try {
      return fn(...args)
    } finally {
      setCurrentSlotOwner(prevOwner)
    }
  }
}

export function createSlot(
  name: string | (() => string) = 'default',
  rawProps?: LooseRawProps | null,
  fallback?: VaporSlot,
  flags: number = 0,
): Block {
  if (isInteropEnabled && isCollectingVdomSlotVNodes) {
    // A Vapor <slot/> cannot expose child vnode metadata without real slot
    // hydration. Bail out so renderSlot() handles it for real.
    return undefined as any
  }

  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  if (!isHydrating) resetInsertionState()
  let hydrationCursor: HydrationCursor | null = null

  const instance = getScopeOwner()!
  const rawSlots = instance.rawSlots
  const scopeId =
    !(flags & VaporSlotFlags.NO_SLOTTED) && instance.type.__scopeId
  const slotScopeIds = scopeId ? [`${scopeId}-s`] : null
  const once = !!(flags & VaporSlotFlags.ONCE)
  const slotRoot = !!(flags & VaporSlotFlags.SLOT_ROOT)
  const slotProps = rawProps
    ? new Proxy(
        once ? snapshotRawProps(rawProps as RawProps) : rawProps,
        rawPropsProxyHandlers,
      )
    : EMPTY_OBJ
  if (once && fallback) {
    const originalFallback = fallback
    fallback = (...args: any[]) => withOnceSlot(() => originalFallback(...args))
  }

  let fragment: VaporFragment
  if (isRef(rawSlots._) && isInteropEnabled) {
    if (isHydrating) hydrationCursor = enterHydrationCursor()
    fragment = instance.appContext.vapor!.vdomSlot(
      rawSlots._,
      name,
      slotProps,
      instance,
      fallback,
      once,
      slotRoot,
    )
  } else {
    if (isHydrating) hydrationCursor = captureHydrationCursor()
    const slotFragment = (fragment = new SlotFragment(slotRoot))
    // mark the slot as forwarded
    slotFragment.forwarded =
      currentSlotOwner != null && currentSlotOwner !== currentInstance
    const isDynamicName = isFunction(name)

    const renderSlot = () => {
      const slotName = isFunction(name) ? name() : name

      // in custom element mode, render <slot/> as actual slot outlets
      // because in shadowRoot: false mode the slot element gets
      // replaced by injected content
      if (
        (instance as GenericComponentInstance).ce ||
        (instance.parent &&
          isAsyncWrapper(instance.parent) &&
          instance.parent.ce)
      ) {
        const el = createElement('slot')
        const setSlotProps = () => {
          setDynamicProps(el, [
            slotProps,
            slotName !== 'default' ? { name: slotName } : {},
          ])
        }
        // Native slot outlets have no component boundary to snapshot props, so
        // v-once applies here by skipping the reactive prop effect.
        if (once) setSlotProps()
        else renderEffect(setSlotProps)
        if (fallback) {
          withOwnedSlotBoundary(slotFragment.parentSlotBoundary, () => {
            const fallbackBlock = fallback()
            // Keep the live fallback block on the SlotFragment itself. The
            // native slot outlet is temporary and gets removed by CE slot
            // replacement, but the fragment remains Vapor's long-lived owner.
            slotFragment.customElementFallback = fallbackBlock
            insert(fallbackBlock, el)
          })
        }
        fragment.nodes = el
        return
      }

      const slot = getSlot(rawSlots, slotName)
      if (slot) {
        slotFragment.updateSlot(getBoundSlot(slot), fallback)
      } else {
        slotFragment.updateSlot(undefined, fallback)
      }
    }

    let cachedSlot: VaporSlot | undefined
    let cachedBoundSlot: VaporSlot | undefined
    const getBoundSlot = (slot: VaporSlot): VaporSlot => {
      if (slot !== cachedSlot) {
        cachedSlot = slot
        cachedBoundSlot = () => {
          const prevSlotScopeIds = setCurrentSlotScopeIds(slotScopeIds)
          try {
            return once ? withOnceSlot(() => slot(slotProps)) : slot(slotProps)
          } finally {
            setCurrentSlotScopeIds(prevSlotScopeIds)
          }
        }
      }
      return cachedBoundSlot!
    }

    // dynamic slot name or has dynamicSlots
    if (!once && (isDynamicName || rawSlots.$)) {
      renderEffect(renderSlot)
    } else {
      renderSlot()
    }
  }

  if (!isHydrating) {
    if (slotScopeIds) {
      setScopeId(fragment, slotScopeIds)
    }

    if (_insertionParent) insert(fragment, _insertionParent, _insertionAnchor)
  } else {
    if (fragment.insert) {
      ;(fragment as VaporFragment).hydrate!()
    }
    exitHydrationCursor(hydrationCursor)
  }

  return fragment
}
