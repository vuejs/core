import { Slot } from '../../src/componentSlots'
import { createSlots } from '../../src/helpers/createSlots'
import { createVNode } from 'vue'

describe('createSlot', () => {
  it('should return a slot', () => {
    const record: Record<string, Slot> = {}
    const slot = () => createVNode(Object)
    const slotDescriptor = [{ name: 'descriptor', fn: slot }]
    const actual = createSlots(record, slotDescriptor)

    expect(actual).toHaveLength(1)
  })
})
