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
  DynamicFragment,
  SlotFragment,
  type VaporFragment,
  isInteropFragment,
} from './fragment'
import { currentSlotBoundary, withSlotBoundary } from './slotBoundary'
import { createElement } from './dom/node'
import { setDynamicProps } from './dom/prop'
import {
  isCollectingVdomSlotVNodes,
  isInteropEnabled,
} from './vdomInteropState'
import { setScopeId, trackScopeIdFragment } from './scopeId'
import { withHydratingSlotBoundary } from './dom/hydrateFragment'

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

export type LooseRawSlots =
  | VaporSlot
  | (Record<string, VaporSlot | DynamicSlotSource[]> & {
      $?: DynamicSlotSource[]
    })

export type StaticSlots = Record<string, VaporSlot>

export type VaporSlot = BlockFn & {
  _?: VaporSlotFlags.NON_STABLE
}
export type DynamicSlot = { name: string; fn: VaporSlot }
export type DynamicSlotFn = () => DynamicSlot | DynamicSlot[]
export type DynamicSlotSource = StaticSlots | DynamicSlotFn

const rawSlotsOwnerMap = new WeakMap<RawSlots, VaporComponentInstance | null>()
const rawSlotWrappersCache = new WeakMap<
  RawSlots,
  Map<
    string,
    {
      slot: VaporSlot
      wrapped: VaporSlot
    }
  >
>()

export function getRawSlotsOwner(
  slots: RawSlots,
): VaporComponentInstance | null {
  return rawSlotsOwnerMap.get(slots) || null
}

export function normalizeRawSlots(
  rawSlots?: LooseRawSlots | null,
): RawSlots | null | undefined {
  if (!rawSlots) return rawSlots
  const normalized = isFunction(rawSlots)
    ? ({ default: rawSlots } as RawSlots)
    : (rawSlots as RawSlots)
  if (!rawSlotsOwnerMap.has(normalized)) {
    rawSlotsOwnerMap.set(normalized, getScopeOwner())
  }
  return normalized
}

function withSlotOwner<T>(slots: RawSlots, fn: () => T): T {
  if (!rawSlotsOwnerMap.has(slots)) {
    return fn()
  }
  const prevOwner = setCurrentSlotOwner(rawSlotsOwnerMap.get(slots) || null)
  try {
    return fn()
  } finally {
    setCurrentSlotOwner(prevOwner)
  }
}

function getOwnedSlot(
  slots: RawSlots,
  key: string,
  slot: VaporSlot,
): VaporSlot {
  if (!rawSlotsOwnerMap.has(slots)) {
    return slot
  }
  let wrappers = rawSlotWrappersCache.get(slots)
  if (!wrappers) {
    rawSlotWrappersCache.set(slots, (wrappers = new Map()))
  }
  const cached = wrappers.get(key)
  if (cached && cached.slot === slot) {
    return cached.wrapped
  }
  const wrapped = ((...args: any[]) =>
    withSlotOwner(slots, () => slot(...args))) as VaporSlot
  wrapped._ = slot._
  wrappers.set(key, { slot, wrapped })
  return wrapped
}

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
    const keys = new Set(Object.keys(target).filter(k => k !== '$'))
    const dynamicSources = target.$
    if (dynamicSources) {
      for (const source of dynamicSources) {
        if (isFunction(source)) {
          const slot = withSlotOwner(target, () =>
            resolveFunctionSource(source),
          )
          if (slot) {
            if (isArray(slot)) {
              for (const s of slot) keys.add(String(s.name))
            } else {
              keys.add(String(slot.name))
            }
          }
        } else {
          for (const key of Object.keys(source)) keys.add(key)
        }
      }
    }
    return [...keys]
  },
  set: NO,
  deleteProperty: NO,
}

export function getSlot(target: RawSlots, key: string): VaporSlot | undefined {
  if (key === '$') return
  const dynamicSources = target.$
  if (dynamicSources) {
    let i = dynamicSources.length
    let source: DynamicSlotSource
    while (i--) {
      source = dynamicSources[i]
      if (isFunction(source)) {
        const slot = withSlotOwner(target, () =>
          resolveFunctionSource(source as DynamicSlotFn),
        )
        if (slot) {
          if (isArray(slot)) {
            for (let j = slot.length - 1; j >= 0; j--) {
              if (String(slot[j].name) === key) {
                return getOwnedSlot(target, key, slot[j].fn)
              }
            }
          } else if (String(slot.name) === key) {
            return getOwnedSlot(target, key, slot.fn)
          }
        }
      } else if (hasOwn(source, key)) {
        return getOwnedSlot(target, key, source[key])
      }
    }
  }
  if (hasOwn(target, key)) {
    return getOwnedSlot(target, key, target[key])
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
    const isCustomElementSlot = !!(
      (instance as GenericComponentInstance).ce ||
      (instance.parent && isAsyncWrapper(instance.parent) && instance.parent.ce)
    )
    const needsSlotFragment = shouldUseSlotFragment(
      rawSlots,
      name,
      fallback,
      isCustomElementSlot,
    )
    const slotFragment = needsSlotFragment
      ? new SlotFragment(slotRoot)
      : undefined
    let dynamicFragment: DynamicFragment | undefined
    if (slotFragment) {
      fragment = slotFragment
    } else {
      // Fast path: DynamicFragment is enough, but hydration still enters the
      // slot boundary so it can own the SSR close marker.
      dynamicFragment = new DynamicFragment(
        __DEV__ ? 'slot' : undefined,
        false,
        false,
      )
      dynamicFragment.isSlot = true
      fragment = dynamicFragment
    }

    if (isHydrating) {
      ;(fragment as DynamicFragment).forwarded =
        currentSlotOwner != null && currentSlotOwner !== currentInstance
    }

    const isDynamicName = isFunction(name)

    const renderSlot = () => {
      const slotName = isFunction(name) ? name() : name

      // in custom element mode, render <slot/> as actual slot outlets
      // because in shadowRoot: false mode the slot element gets
      // replaced by injected content
      if (isCustomElementSlot) {
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
          withSlotBoundary(slotFragment!.slotBoundary, () => {
            const fallbackBlock = fallback()
            // Keep the live fallback block on the SlotFragment itself. The
            // native slot outlet is temporary and gets removed by CE slot
            // replacement, but the fragment remains Vapor's long-lived owner.
            slotFragment!.customElementFallback = fallbackBlock
            insert(fallbackBlock, el)
          })
        }
        fragment.nodes = el
        return
      }

      const slot = getSlot(rawSlots, slotName)
      const render = slot ? getBoundSlot(slot) : undefined
      if (slotFragment) {
        slotFragment.updateSlot(render, fallback)
      } else {
        // When no slot render exists, the fast path hands fallback to the
        // DynamicFragment; during hydration it owns the slot SSR range, so
        // empty dynamic roots get its close marker.
        if (isHydrating) {
          withHydratingSlotBoundary(() =>
            dynamicFragment!.update(render || fallback),
          )
        } else {
          dynamicFragment!.update(render || fallback)
        }
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
    if (isInteropEnabled && isInteropFragment(fragment)) {
      fragment.hydrate!()
    }
    // Hydrated slot roots already have SSR scope attrs. Only register tracking
    // so future client-inserted slot branches receive the same ids.
    if (slotScopeIds) {
      trackScopeIdFragment(fragment, slotScopeIds)
    }
    exitHydrationCursor(hydrationCursor)
  }

  return fragment
}

function shouldUseSlotFragment(
  rawSlots: RawSlots,
  name: string | (() => string),
  fallback: VaporSlot | undefined,
  isCustomElementSlot: boolean,
): boolean {
  // Native CE slots render a real <slot>, so SlotFragment owns fallback.
  if (isCustomElementSlot) return true

  // Nested fallback resolution must preserve the boundary chain.
  if (currentSlotBoundary) return true

  // Without fallback, there is no fallback branch to track.
  if (!fallback) return false

  // No slots means fallback is the only possible branch.
  if (rawSlots === EMPTY_OBJ) return false

  // Dynamic names and dynamic slot sources still need runtime resolution.
  if (isFunction(name) || rawSlots.$) return true

  const slot = getSlot(rawSlots, name)
  // No matching static slot means fallback is the only possible branch.
  if (!slot) return false

  // Non-stable slot content can become invalid, making fallback reachable.
  return slot._ === VaporSlotFlags.NON_STABLE
}
