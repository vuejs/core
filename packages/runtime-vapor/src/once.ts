/**
 * Whether the code running now belongs to a v-once region: slot content or
 * fallback rendered by a `<slot v-once>`, or a compiled v-once directive.
 * While set, renderEffect runs its function once instead of creating an
 * effect. Every component boundary resets it (Vapor setup, vdom mount), and
 * deferred work captures it at creation. Call sites test `inOnce` first so
 * the common path pays neither the closure nor the call.
 */
export let inOnce = false

export function setInOnce(value: boolean): void {
  inOnce = value
}

export function withOnce<T>(fn: () => T, value = true): T {
  if (inOnce === value) return fn()
  const prev = inOnce
  try {
    inOnce = value
    return fn()
  } finally {
    inOnce = prev
  }
}
