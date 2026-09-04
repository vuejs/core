/**
 * Flags to optimize vapor `createFor` runtime behavior, shared between the
 * compiler and the runtime
 */
export enum VaporVForFlags {
  /**
   * v-for is the only child of a parent container, so it can take the fast
   * path with textContent = '' when the whole list is emptied
   */
  FAST_REMOVE = 1,
  /**
   * v-for used on a component-shaped item. Component items require structural
   * removal before item scope cleanup and cannot use the fast-clear path. This
   * does not guarantee the item block is a VaporComponentInstance: component
   * fallback paths may still return a DOM Node.
   */
  IS_COMPONENT = 1 << 1,
  /**
   * v-for inside v-once
   */
  ONCE = 1 << 2,
  /**
   * v-for item block is a single DOM Node.
   */
  IS_SINGLE_NODE = 1 << 3,
  /**
   * v-for item block is known to be a VaporFragment, so runtime can use
   * fragment-specific insert/remove helpers.
   */
  IS_FRAGMENT = 1 << 4,
  /**
   * v-for sits on a slot content/fallback root chain and can change slot
   * validity.
   */
  SLOT_ROOT = 1 << 5,
  /**
   * The server wraps every row in `<!--[-->...<!--]-->`: the row template is
   * not a single element (compiler-ssr `needFragmentWrapper`). Hydration
   * treats a leading `<!--[-->` as the row wrapper rather than as the row
   * content's own marker.
   */
  WRAPPED_ROWS = 1 << 6,
}

export enum VaporBlockShape {
  EMPTY = 0,
  SINGLE_ROOT = 1,
  MULTI_ROOT = 2,
}

/**
 * Bit layout for vapor `createIf` flags.
 *
 * - bits 0-1: true branch VaporBlockShape
 * - bits 2-3: false branch VaporBlockShape
 * - bit 4: v-once
 * - bit 5: true branch is static and can skip branch-owned EffectScope
 * - bit 6: false branch is static and can skip branch-owned EffectScope
 * - bit 7: v-if sits on a slot content/fallback root chain
 * - bits 8+: branch index + 1 for keyed dynamic fragments
 *
 * Examples:
 * - v-once, true single-root, no false branch: 1 | ONCE = 17
 * - keyed index 0, true/false single-root: 1 | (1 << 2) | (1 << 8) = 261
 */
export enum VaporIfFlags {
  /**
   * Documents the packed true/false branch shape bits. Runtime decode shifts
   * to the selected branch first, then masks with 0b11 for one VaporBlockShape.
   */
  BLOCK_SHAPE = 0b1111,
  /**
   * Marks a branch that is created once and never updated.
   */
  ONCE = 1 << 4,
  /**
   * The compiler proved that the true branch only returns static template nodes,
   * so runtime can skip creating a branch-owned EffectScope.
   */
  TRUE_NO_SCOPE = 1 << 5,
  /**
   * The compiler proved that the false branch only returns static template
   * nodes, so runtime can skip creating a branch-owned EffectScope.
   */
  FALSE_NO_SCOPE = 1 << 6,
  /**
   * v-if sits on a slot content/fallback root chain and can change slot
   * validity.
   */
  SLOT_ROOT = 1 << 7,
  /**
   * Shift for keyed branch index. The encoded value is index + 1, so decoded
   * zero means "not keyed" and source index 0 still round-trips.
   */
  INDEX_SHIFT = 8,
}

/**
 * Flags used by vapor template factories, shared between the compiler and the
 * runtime.
 */
export enum TemplateFlags {
  ROOT = 1,
  STATIC = 1 << 1,
}

/**
 * Flags used by vapor slot outlets, shared between the compiler and the
 * runtime.
 */
export enum VaporSlotFlags {
  NO_SLOTTED = 1,
  ONCE = 1 << 1,
  // The outlet is a dynamic root on a forwarded slot chain. It exposes its
  // content validity to the enclosing boundary (unless ONCE) and, without
  // SHARED_FALLBACK, may resolve an enclosing fallback after its own local
  // fallback is exhausted.
  FORWARDED = 1 << 2,
  // Implies FORWARDED: multiple independently invalid roots share one
  // enclosing fallback decision instead of resolving that fallback from each
  // root.
  SHARED_FALLBACK = 1 << 3,
}

export function isForwardedSlot(flags: number): boolean {
  return !!(flags & (VaporSlotFlags.FORWARDED | VaporSlotFlags.SHARED_FALLBACK))
}

export function slotInheritsFallback(flags: number): boolean {
  return isForwardedSlot(flags) && !(flags & VaporSlotFlags.SHARED_FALLBACK)
}

// v-once content never changes validity, so it has nothing to notify.
export function slotNotifiesBoundary(flags: number): boolean {
  return isForwardedSlot(flags) && !(flags & VaporSlotFlags.ONCE)
}

/**
 * Per-slot-function metadata attached by the compiler as `fn._`.
 */
export enum VaporSlotStability {
  // The slot content root can start invalid or become invalid, so fallback
  // may be reachable and needs SlotFragment tracking.
  NON_STABLE = 1,
}

export enum VaporDynamicComponentFlags {
  SINGLE_ROOT = 1,
  ONCE = 1 << 1,
  SLOT_ROOT = 1 << 2,
}
