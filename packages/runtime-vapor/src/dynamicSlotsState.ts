// Set by compiled code that passes dynamic slot sources (`$`) and by the vdom
// interop plugin. Applications without them leave it false, so the dynamic
// slot resolution tree-shakes out.
export let isDynamicSlotsEnabled = false

export function enableDynamicSlots(): void {
  isDynamicSlotsEnabled = true
}
