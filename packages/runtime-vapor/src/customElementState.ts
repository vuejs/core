// Set by VaporElement. Applications without vapor custom elements leave it
// false, so the custom element branches tree-shake out.
export let isCustomElementEnabled = false

export function enableCustomElement(): void {
  isCustomElementEnabled = true
}
