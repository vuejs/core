export function warn(msg: string, ...args: any[]): void {
  console.warn(`[Vue warn] ${msg}`, ...args)
}

/**
 * Like `warn()`, but appends a "Did you mean ..." suggestion on a separate
 * visual line below the main warning. Use for warning sites that have a
 * well-known fix the user can act on.
 *
 * Dev-only — returns early under `__DEV__` false. No trace / re-entrancy
 * guard because reactivity has no warning-context stack of its own.
 */
export function warnWithSuggestion(
  msg: string,
  suggestion: string,
  ...args: any[]
): void {
  if (!__DEV__) return
  console.warn(`[Vue warn] ${msg}`, ...args, `\n${suggestion}`)
}
