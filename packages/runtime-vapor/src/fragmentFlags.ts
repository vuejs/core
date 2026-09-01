export const FRAGMENT: number = 1
export const DYNAMIC: number = 1 << 1
export const SLOT: number = 1 << 2
export const FOR: number = 1 << 3
export const FOR_ITEM: number = 1 << 4
export const TELEPORT: number = 1 << 5
export const VDOM: number = 1 << 6
export const SLOT_OUTLET: number = 1 << 7
/** `v-if` fragment: a multi-root branch reuses the SSR `<!--]-->` close. */
export const IF: number = 1 << 8
/**
 * Default-slot children of a dynamic element resolved to a native tag. Has no
 * SSR-provided anchor; hydration injects and reuses its own runtime anchor.
 */
export const NATIVE_CHILDREN: number = 1 << 9

/**
 * Set only by the SlotFragment class: the fragment runs the slot resolution
 * state machine (SlotResolutionState). Fast-path outlet fragments carry SLOT
 * but not this bit.
 */
export const SLOT_RESOLVER: number = 1 << 10

// Subtype bits only — the DynamicFragment constructor adds DYNAMIC itself.
export const SLOT_FRAGMENT: number = SLOT | SLOT_OUTLET
