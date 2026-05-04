// if vdom interop plugin is not installed, isInteropEnabled will be false
// the interop code path will be tree-shaken out by bundlers
export let isInteropEnabled = false

export function setInteropEnabled(): void {
  isInteropEnabled = true
}
