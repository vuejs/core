// Kept out of hydration.ts: dom/node.ts reads `isHydrating` but is bundled
// before hydration.ts (which imports it), and bundlers don't fold a binding
// read ahead of its declaration, so client-only apps kept hydration code.
export let isHydrating = false

export function setHydrating(value: boolean): boolean {
  const prev = isHydrating
  isHydrating = value
  return prev
}
