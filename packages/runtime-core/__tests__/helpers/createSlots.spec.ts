import { Slot } from '../../src/componentSlots'
import { createSlots } from '../../src/helpers/createSlots'

describe('createSlot', () => {
  it('should return a slot', () => {
    const record: Record<string, Slot> = {}
    const slot = () => []
    const dynamicSlot = [{ name: 'descriptor', fn: slot }]
    const actual = createSlots(record, dynamicSlot)

    expect(actual).toEqual({ descriptor: slot })
  })
})
