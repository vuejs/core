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
   * v-for used on component - we can skip creating child scopes for each block
   * because the component itself already has a scope. This does not guarantee
   * the item block is a VaporComponentInstance: component fallback paths may
   * still return a DOM Node.
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
}

export enum VaporBlockShape {
  EMPTY = 0,
  SINGLE_ROOT = 1,
  MULTI_ROOT = 2,
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
}
