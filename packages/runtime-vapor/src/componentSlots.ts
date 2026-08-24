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
  isHydrating,
} from './dom/hydration'
import {
  DynamicFragment,
  SlotFragment,
  type VaporFragment,
  finishBlockCreation,
  isInteropFragment,
} from './fragment'
import { OWNS_ANCHOR, SLOT_FRAGMENT } from './fragmentFlags'
import { currentSlotBoundary, withSlotBoundary } from './slotBoundary'
import { createElement } from './dom/node'
import { setDynamicProps } from './dom/prop'
import { isInteropEnabled } from './vdomInteropState'
import {
  currentSlotScopeIds,
  renderWithSlotScopeIds,
  setCurrentSlotScopeIds,
  setElementScopeIds,
} from './scopeId'
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
export type DynamicSlot = { name: string; fn: VaporSlot; key?: unknown }
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
  const slot = resolveSlot(target, key)
  if (slot) {
    return getOwnedSlot(target, key, isFunction(slot) ? slot : slot.fn)
  }
}

function resolveSlot(
  target: RawSlots,
  key: string,
): VaporSlot | DynamicSlot | undefined {
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
                return slot[j]
              }
            }
          } else if (String(slot.name) === key) {
            return slot
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

export function createSlot(
  name: string | (() => string) = 'default',
  rawProps?: LooseRawProps | null,
  fallback?: VaporSlot,
  flags: number = 0,
): Block {
  const _insertionParent = insertionParent
  const _insertionAnchor = insertionAnchor
  if (!isHydrating) resetInsertionState()
  let hydrationCursor: HydrationCursor | null = null

  const instance = getScopeOwner()!
  const rawSlots = instance.rawSlots
  const scopeId =
    !(flags & VaporSlotFlags.NO_SLOTTED) && instance.type.__scopeId
  // The outlet's id cell: its own `-s` id merged onto the outer slot context,
  // so forwarded slot content accumulates every level's ids (VDOM
  // processFragment concat semantics).
  const outerSlotScopeIds = currentSlotScopeIds
  const slotScopeIds = scopeId
    ? outerSlotScopeIds
      ? [...outerSlotScopeIds, `${scopeId}-s`]
      : [`${scopeId}-s`]
    : outerSlotScopeIds
  const once = !!(flags & VaporSlotFlags.ONCE)
  const slotRoot = !!(flags & VaporSlotFlags.SLOT_ROOT)
  const sharedFallback = !!(flags & VaporSlotFlags.SHARED_FALLBACK)
  const inheritFallback = !!(flags & VaporSlotFlags.INHERIT_FALLBACK)
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
  let isCustomElementSlot = false
  if (isRef(rawSlots._) && isInteropEnabled) {
    if (isHydrating) hydrationCursor = enterHydrationCursor()
    // Establish the outlet cell as the creation ambient; the interop slot
    // captures it as the base patch context for the vdom-rendered content.
    const prevSlotScopeIds = setCurrentSlotScopeIds(slotScopeIds)
    try {
      fragment = instance.appContext.vdom!.slot(
        rawSlots._,
        name,
        slotProps,
        instance,
        fallback,
        once,
        slotRoot,
        sharedFallback,
        inheritFallback,
        _insertionAnchor,
      )
    } finally {
      setCurrentSlotScopeIds(prevSlotScopeIds)
    }
  } else {
    if (isHydrating) hydrationCursor = captureHydrationCursor()
    isCustomElementSlot = !!(
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
      ? new SlotFragment(
          slotRoot,
          sharedFallback,
          inheritFallback,
          _insertionAnchor,
        )
      : undefined
    let dynamicFragment: DynamicFragment | undefined
    if (slotFragment) {
      fragment = slotFragment
    } else {
      // Fast path: DynamicFragment is enough, but hydration still enters the
      // slot boundary so it can own the SSR close marker.
      dynamicFragment = new DynamicFragment(
        SLOT_FRAGMENT | OWNS_ANCHOR,
        __DEV__ ? 'slot' : undefined,
        false,
        false,
        false,
        undefined,
        _insertionAnchor,
      )
      fragment = dynamicFragment
    }
    // Replace the construction-time capture with the outlet cell so late
    // renders (fallbacks, branch switches) run under the merged context.
    ;(fragment as SlotFragment | DynamicFragment).slotScopeIds = slotScopeIds

    const isDynamicName = isFunction(name)

    const renderSlot = () => {
      const slotName = isFunction(name) ? name() : name

      // in custom element mode, render <slot/> as actual slot outlets
      // because in shadowRoot: false mode the slot element gets
      // replaced by injected content
      if (isCustomElementSlot) {
        const el = createElement('slot')
        if (slotScopeIds) setElementScopeIds(el, slotScopeIds)
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
          // The fallback renders outside the fragment's own render seam, so
          // establish the outlet cell explicitly around it.
          const prevSlotScopeIds = setCurrentSlotScopeIds(slotScopeIds)
          try {
            withSlotBoundary(slotFragment!.slotBoundary, () => {
              const fallbackBlock = fallback()
              // Keep the live fallback block on the SlotFragment itself. The
              // native slot outlet is temporary and gets removed by CE slot
              // replacement, but the fragment remains Vapor's long-lived
              // owner.
              slotFragment!.customElementFallback = fallbackBlock
              insert(fallbackBlock, el)
            })
          } finally {
            setCurrentSlotScopeIds(prevSlotScopeIds)
          }
        }
        fragment.nodes = el
        return
      }

      const resolvedSlot = resolveSlot(rawSlots, slotName)
      const slot = resolvedSlot
        ? getOwnedSlot(
            rawSlots,
            slotName,
            isFunction(resolvedSlot) ? resolvedSlot : resolvedSlot.fn,
          )
        : undefined
      const render = slot ? getBoundSlot(slot) : undefined
      const key =
        resolvedSlot && !isFunction(resolvedSlot) && hasOwn(resolvedSlot, 'key')
          ? resolvedSlot.key
          : render || fallback
      if (slotFragment) {
        slotFragment.updateSlot(render, fallback, key)
      } else {
        // When no slot render exists, the fast path hands fallback to the
        // DynamicFragment; during hydration it owns the slot SSR range, so
        // empty dynamic roots get its close marker.
        if (isHydrating) {
          withHydratingSlotBoundary(() =>
            dynamicFragment!.update(render || fallback, key),
          )
        } else {
          dynamicFragment!.update(render || fallback, key)
        }
      }
    }

    let cachedSlot: VaporSlot | undefined
    let cachedBoundSlot: VaporSlot | undefined
    const getBoundSlot = (slot: VaporSlot): VaporSlot => {
      if (slot !== cachedSlot) {
        cachedSlot = slot
        // Re-establishes the outlet cell (interop may invoke the slot outside
        // the fragment's render seam) and catches up out-of-window content.
        cachedBoundSlot = () =>
          renderWithSlotScopeIds(slotScopeIds, () =>
            once ? withOnceSlot(() => slot(slotProps)) : slot(slotProps),
          )
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

  if (isHydrating && isInteropEnabled && isInteropFragment(fragment)) {
    fragment.hydrate!()
  }

  // Custom-element outlets assign their native <slot> directly instead of
  // rendering through update(), so they still need this initial insertion even
  // after adopting the template anchor.
  finishBlockCreation(
    fragment,
    fragment.anchor,
    hydrationCursor,
    _insertionParent,
    _insertionAnchor,
    isCustomElementSlot,
  )

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
