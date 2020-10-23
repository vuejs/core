import { Slot } from '../componentSlots'
import { isArray } from '@vue/shared'

interface CompiledSlotDescriptor {
  name: string
  fn: Slot
}

/**
 * Compiler runtime helper for creating dynamic slots object
 * @private
 */
export function createSlots(
  slots: Record<string, Slot | number>,
  dynamicSlots: (
    | CompiledSlotDescriptor
    | CompiledSlotDescriptor[]
    | undefined)[]
): Record<string, Slot | number> {
  for (let i = 0; i < dynamicSlots.length; i++) {
    const slot = dynamicSlots[i]
    // array of dynamic slot generated by <template v-for="..." #[...]>
    if (isArray(slot)) {
      for (let j = 0; j < slot.length; j++) {
        slots[slot[j].name] = slot[j].fn
      }
    } else if (slot) {
      // conditional single slot generated by <template v-if="..." #foo>
      slots[slot.name] = slot.fn
    }
  }
  return slots
}
