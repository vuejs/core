import { EMPTY_OBJ } from '@vue/shared'
import { Slots } from '../componentSlots'

interface DefaultContext {
  props: Record<string, unknown>
  attrs: Record<string, unknown>
  emit: (...args: any[]) => void
  slots: Slots
}

export function useSetupContext<T extends Partial<DefaultContext> = {}>(
  opts?: any // TODO infer
): { [K in keyof DefaultContext]: T[K] extends {} ? T[K] : DefaultContext[K] } {
  return EMPTY_OBJ as any
}
