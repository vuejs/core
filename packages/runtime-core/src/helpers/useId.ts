import { type GenericComponentInstance, currentInstance } from '../component'
import { currentRenderingInstance } from '../componentRenderContext'
import { warn } from '../warning'

export function useId(): string {
  // slot content counts with its author. In vapor a slot renders with the
  // rendering component as the current instance: the author is the rendering
  // instance `withCtx` restores for a vdom slot, or the owner of a vapor one.
  // A vdom instance in setup ignores the rendering instance, which is its
  // parent in SSR
  const i = currentInstance
    ? (currentInstance.vapor && currentRenderingInstance) ||
      currentInstance.slotOwner ||
      currentInstance
    : currentRenderingInstance
  if (i) {
    return (i.appContext.config.idPrefix || 'v') + '-' + i.ids[0] + i.ids[1]++
  } else if (__DEV__) {
    warn(
      `useId() is called when there is no active component ` +
        `instance to be associated with.`,
    )
  }
  return ''
}

/**
 * There are 3 types of async boundaries:
 * - async components
 * - components with async setup()
 * - components with serverPrefetch
 */
export function markAsyncBoundary(instance: GenericComponentInstance): void {
  instance.ids = [instance.ids[0] + instance.ids[2]++ + '-', 0, 0]
}
