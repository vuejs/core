import { createSlots } from '../../src/helpers/createSlots'

describe('createSlot', () => {
  it('should return a slot', () => {
    const slot = () => [{}]
    const slotDescriptor = 'descriptor'
    const actual = createSlots(slot, slotDescriptor)

    expect(actual).toHaveLength(1)
  })
})
