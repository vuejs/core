// A render effect evaluates all reads before publishing its DOM writes.
// Nested effects restore their parent's buffer after collecting their own.
export let pendingDomUpdates: (() => void)[] | undefined

export function setPendingDomUpdates(
  updates: (() => void)[] | undefined,
): (() => void)[] | undefined {
  const previous = pendingDomUpdates
  pendingDomUpdates = updates
  return previous
}
