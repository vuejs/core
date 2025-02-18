import { isOn } from '@vue/shared'
import type { ComponentInternalInstance } from '../component'
import { DeprecationTypes, assertCompatEnabled } from './compatConfig'

export function getCompatListeners(
  instance: ComponentInternalInstance,
): Record<string, Function | Function[]> {
  assertCompatEnabled(DeprecationTypes.INSTANCE_LISTENERS, instance)

  const listeners: Record<string, Function | Function[]> = {}
  const rawProps = instance.vnode.props
  if (!rawProps) {
    return listeners
  }
  for (const key in rawProps) {
    if (isOn(key)) {
      listeners[key[2].toLowerCase() + key.slice(3)] = rawProps[key]
    }
  }
  return listeners
}
