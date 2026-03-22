import { describe, expect, test } from 'vitest'
import { getSwiftLines } from './utils'

describe('spatial: v-for', () => {
  test('basic v-for', () => {
    const lines = getSwiftLines(
      `<text v-for="item in items" :key="item.id">{{ item.name }}</text>`,
    )
    expect(lines.some(l => l.includes('ForEach(vm.getArray("items")'))).toBe(
      true,
    )
    expect(lines.some(l => l.includes('item in'))).toBe(true)
    expect(lines).toContain('}')
  })

  test('v-for with container', () => {
    const lines = getSwiftLines(
      `<v-stack><text v-for="msg in messages" :key="msg.id">{{ msg.text }}</text></v-stack>`,
    )
    expect(lines.some(l => l.includes('VStack {'))).toBe(true)
    expect(lines.some(l => l.includes('ForEach(vm.getArray("messages")'))).toBe(
      true,
    )
  })
})
