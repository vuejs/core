// Set by the code the compiler emits for an SFC with scoped styles, and by
// the vdom interop plugin. Applications without scoped styles leave it false,
// so the scope id code tree-shakes out.
export let isScopeIdEnabled = false

export function enableScopeId(): void {
  isScopeIdEnabled = true
}
