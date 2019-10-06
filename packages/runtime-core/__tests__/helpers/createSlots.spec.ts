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

  it('should add all slots to the record', () => {
    const record: Record<string, Slot> = {}
    const slot = () => []
    const dynamicSlot = [
      { name: 'descriptor', fn: slot },
      { name: 'descriptor2', fn: slot }
    ]
    const actual = createSlots(record, dynamicSlot)

    expect(actual).toEqual({ descriptor: slot, descriptor2: slot })
  })

  it('should add each slot to the record when given slot is an array', () => {
    const record: Record<string, Slot> = { descriptor2: () => [] }
    const slot = () => []
    const dynamicSlot = [
      { name: 'descriptor', fn: slot },
      [{ name: 'descriptor2', fn: slot }]
    ]
    const actual = createSlots(record, dynamicSlot)

    expect(actual).toEqual({ descriptor: slot, descriptor2: slot })
  })
})
