// Set by defineVaporAsyncComponent. Applications without async components
// leave it false, so the wrapper-aware branches tree-shake out.
export let isAsyncComponentEnabled = false

export function enableAsyncComponent(): void {
  isAsyncComponentEnabled = true
}
