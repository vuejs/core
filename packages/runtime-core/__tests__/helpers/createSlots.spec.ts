import { Slot } from '../../src/componentSlots'
import { createSlots } from '../../src/helpers/createSlots'

describe('createSlot', () => {
  const slot = () => []
  let record: Record<string, Slot>

  beforeEach(() => {
    record = {}
  })

  it('should return a slot', () => {
    const dynamicSlot = [{ name: 'descriptor', fn: slot }]

    const actual = createSlots(record, dynamicSlot)

    expect(actual).toEqual({ descriptor: slot })
  })

  it('should add all slots to the record', () => {
    const dynamicSlot = [
      { name: 'descriptor', fn: slot },
      { name: 'descriptor2', fn: slot }
    ]

    const actual = createSlots(record, dynamicSlot)

    expect(actual).toEqual({ descriptor: slot, descriptor2: slot })
  })

  it('should add slot to the record when given slot is an array', () => {
    const dynamicSlot = [
      { name: 'descriptor', fn: slot },
      [{ name: 'descriptor2', fn: slot }]
    ]

    const actual = createSlots(record, dynamicSlot)

    expect(actual).toEqual({ descriptor: slot, descriptor2: slot })
  })

  it('should add each slot to the record when given slot is an array', () => {
    const dynamicSlot = [
      { name: 'descriptor', fn: slot },
      [{ name: 'descriptor2', fn: slot }, { name: 'descriptor3', fn: slot }]
    ]

    const actual = createSlots(record, dynamicSlot)

    expect(actual).toEqual({
      descriptor: slot,
      descriptor2: slot,
      descriptor3: slot
    })
  })
})
