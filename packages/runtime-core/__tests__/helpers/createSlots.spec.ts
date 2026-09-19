import type { Slot } from '../../src/componentSlots'
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

  it('should attach key', () => {
    const dynamicSlot = [{ name: 'descriptor', fn: slot, key: '1' }]

    const actual = createSlots(record, dynamicSlot)
    const ret = actual.descriptor()
    // @ts-expect-error
    expect(ret.key).toBe('1')
  })

  it('should check nullability', () => {
    const slot = (() => {}) as Slot
    const dynamicSlot = [{ name: 'descriptor', fn: slot, key: '1' }]

    const actual = createSlots(record, dynamicSlot)
    expect(actual).toHaveProperty('descriptor')
  })

  it('should add all slots to the record', () => {
    const dynamicSlot = [
      { name: 'descriptor', fn: slot },
      { name: 'descriptor2', fn: slot },
    ]

    const actual = createSlots(record, dynamicSlot)

    expect(actual).toEqual({ descriptor: slot, descriptor2: slot })
  })

  it('should add slot to the record when given slot is an array', () => {
    const dynamicSlot = [
      { name: 'descriptor', fn: slot },
      [{ name: 'descriptor2', fn: slot }],
    ]

    const actual = createSlots(record, dynamicSlot)

    expect(actual).toEqual({ descriptor: slot, descriptor2: slot })
  })

  it('should add each slot to the record when given slot is an array', () => {
    const dynamicSlot = [
      { name: 'descriptor', fn: slot },
      [
        { name: 'descriptor2', fn: slot },
        { name: 'descriptor3', fn: slot },
      ],
    ]

    const actual = createSlots(record, dynamicSlot)

    expect(actual).toEqual({
      descriptor: slot,
      descriptor2: slot,
      descriptor3: slot,
    })
  })

  describe('order parameter', () => {
    it('should treat duplicate slot names as a no-op (v-if/v-else branches)', () => {
      record = { default: slot }

      const actual = createSlots(
        record,
        [
          { name: 'header', fn: slot, key: '0' },
          { name: 'header', fn: slot, key: '1' },
        ],
        ['header', 'header'],
      )

      expect(Object.keys(actual)).toEqual(['default', 'header'])
      expect(actual).toHaveProperty('header')
    })

    // Simulates `<template v-if #header> / <template v-else #footer>`
    it('should reorder mutually exclusive slots from the active branch', () => {
      record = { default: slot }

      const actual = createSlots(
        record,
        [{ name: 'footer', fn: slot }],
        ['header', 'footer'],
      )

      const keys = Object.keys(actual)
      expect(keys).toEqual(['default', 'footer'])
      expect(actual).toHaveProperty('footer', slot)
      expect(actual).not.toHaveProperty('header')
    })

    it('should leave slots unchanged when order is an empty array', () => {
      const actual = createSlots(record, [{ name: 'default', fn: slot }], [])

      expect(Object.keys(actual)).toEqual(['default'])
      expect(actual).toHaveProperty('default', slot)
    })

    it('should leave keys not in the order array untouched', () => {
      record = { _: 2 as any, default: slot }

      const actual = createSlots(
        record,
        [
          { name: 'header', fn: slot },
          { name: 'footer', fn: slot },
        ],
        ['header', 'footer'],
      )

      const keys = Object.keys(actual)
      expect(keys).toEqual(['_', 'default', 'header', 'footer'])
      expect(actual).toHaveProperty('_', 2)
      expect(actual).toHaveProperty('default', slot)
      expect(actual).toHaveProperty('header', slot)
      expect(actual).toHaveProperty('footer', slot)
    })
  })
})
