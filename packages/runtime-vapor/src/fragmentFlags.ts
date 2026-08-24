export const FRAGMENT: number = 1
export const DYNAMIC: number = 1 << 1
export const SLOT: number = 1 << 2
export const FOR: number = 1 << 3
export const FOR_ITEM: number = 1 << 4
export const TELEPORT: number = 1 << 5
export const VDOM: number = 1 << 6
export const SLOT_OUTLET: number = 1 << 7
/**
 * The fragment manages its own dynamic anchor instead of deriving one from an
 * SSR structural marker. Set by every dynamic fragment kind that can hydrate;
 * `resolveDynamicAnchor` uses it to decide whether an empty branch may claim or
 * create an anchor of its own.
 */
export const OWNS_ANCHOR: number = 1 << 8
/** `v-if` fragment: a multi-root branch reuses the SSR `<!--]-->` close. */
export const IF: number = 1 << 9
/**
 * Default-slot children of a dynamic element resolved to a native tag. Has no
 * SSR-provided anchor; hydration injects and reuses its own runtime anchor.
 */
export const NATIVE_CHILDREN: number = 1 << 10

export const SLOT_FRAGMENT: number = DYNAMIC | SLOT | SLOT_OUTLET
