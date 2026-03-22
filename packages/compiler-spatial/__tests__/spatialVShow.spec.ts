import { describe, expect, test } from 'vitest'
import { getSwiftLines } from './utils'

describe('spatial: v-show', () => {
  test('basic v-show', () => {
    const lines = getSwiftLines(`<text v-show="visible">Hello</text>`)
    expect(
      lines.some(l => l.includes('.opacity(vm.get("visible") ? 1 : 0)')),
    ).toBe(true)
  })
})
