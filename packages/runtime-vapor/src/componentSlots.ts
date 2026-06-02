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
  getCurrentSlotBoundary,
  isDynamicFragment,
  withOwnedSlotBoundary,
} from './fragment'
import { createElement } from './dom/node'
import { setDynamicProps } from './dom/prop'
import {
  isCollectingVdomSlotVNodes,
  isInteropEnabled,
} from './vdomInteropState'
import { setScopeId, trackScopeIdFragment } from './scopeId'

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

export type VaporSlot = BlockFn
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
    const needsSlotFragment =
      isHydrating ||
      !!fallback ||
      !!getCurrentSlotBoundary() ||
      isCustomElementSlot
    const slotFragment = needsSlotFragment
      ? new SlotFragment(slotRoot)
      : undefined
    let dynamicFragment: DynamicFragment | undefined
    if (slotFragment) {
      fragment = slotFragment
      if (isHydrating) {
        // Hydration uses forwarded slots to decide close marker ownership.
        slotFragment.forwarded =
          currentSlotOwner != null && currentSlotOwner !== currentInstance
      }
    } else {
      // Fast path: plain slots without fallback/boundary semantics only need a
      // DynamicFragment. SlotFragment is reserved for fallback owners.
      dynamicFragment = new DynamicFragment(
        __DEV__ ? 'slot' : undefined,
        false,
        false,
      )
      dynamicFragment.isSlot = true
      fragment = dynamicFragment
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
          withOwnedSlotBoundary(slotFragment!.parentSlotBoundary, () => {
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
      if (slot) {
        if (slotFragment) {
          slotFragment.updateSlot(getBoundSlot(slot), fallback)
        } else {
          dynamicFragment!.update(getBoundSlot(slot))
        }
      } else if (slotFragment) {
        slotFragment.updateSlot(undefined, fallback)
      } else {
        dynamicFragment!.update()
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
    // Hydrated slot roots already have SSR scope attrs. Only register tracking
    // so future client-inserted slot branches receive the same ids.
    if (slotScopeIds && isDynamicFragment(fragment)) {
      trackScopeIdFragment(fragment, slotScopeIds)
    }
    exitHydrationCursor(hydrationCursor)
  }

  return fragment
}
