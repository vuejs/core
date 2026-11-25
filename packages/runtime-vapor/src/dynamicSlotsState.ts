// Set by compiled code that passes dynamic slot sources (`$`) and by the vdom
// interop plugin. Applications without them leave it false, so the dynamic
// slot resolution tree-shakes out.
export let isDynamicSlotsEnabled = false

export function enableDynamicSlots(): void {
  isDynamicSlotsEnabled = true
}

// Set by compiled code whose slot outlets pass dynamic props (`$`, from
// `v-bind="obj"` or dynamic keys) and by the vdom interop plugin. Without
// them, slot props resolve through a lighter proxy.
export let isDynamicSlotPropsEnabled = false

export function enableDynamicSlotProps(): void {
  isDynamicSlotPropsEnabled = true
}
