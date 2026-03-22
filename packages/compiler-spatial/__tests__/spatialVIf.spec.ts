import { describe, expect, test } from 'vitest'
import { getSwiftLines } from './utils'

describe('spatial: v-if', () => {
  test('basic v-if', () => {
    const lines = getSwiftLines(`<text v-if="isLoggedIn">Welcome</text>`)
    expect(lines.some(l => l.includes('if vm.get("isLoggedIn")'))).toBe(true)
    expect(lines.some(l => l.includes('Text("Welcome")'))).toBe(true)
    expect(lines).toContain('}')
  })

  test('v-if with v-else', () => {
    const lines = getSwiftLines(
      `<text v-if="isLoggedIn">Welcome</text><text v-else>Please log in</text>`,
    )
    expect(lines.some(l => l.includes('if vm.get("isLoggedIn")'))).toBe(true)
    expect(lines.some(l => l.includes('} else {'))).toBe(true)
    expect(lines.some(l => l.includes('Text("Welcome")'))).toBe(true)
    expect(lines.some(l => l.includes('Text("Please log in")'))).toBe(true)
  })

  test('v-if with v-else-if and v-else', () => {
    const lines = getSwiftLines(
      `<text v-if="a">A</text><text v-else-if="b">B</text><text v-else>C</text>`,
    )
    expect(lines.some(l => l.includes('if vm.get("a")'))).toBe(true)
    expect(lines.some(l => l.includes('} else if vm.get("b")'))).toBe(true)
    expect(lines.some(l => l.includes('} else {'))).toBe(true)
  })
})
