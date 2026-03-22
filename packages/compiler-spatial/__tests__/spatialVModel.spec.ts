import { describe, expect, test } from 'vitest'
import { getSwiftLines } from './utils'

describe('spatial: v-model', () => {
  test('v-model on text-field', () => {
    const lines = getSwiftLines(
      `<text-field v-model="username" placeholder="Enter name" />`,
    )
    expect(
      lines.some(l =>
        l.includes('TextField("Enter name", text: vm.binding("username"))'),
      ),
    ).toBe(true)
  })

  test('v-model on toggle', () => {
    const lines = getSwiftLines(`<toggle v-model="enabled" />`)
    expect(lines.some(l => l.includes('vm.binding("enabled")'))).toBe(true)
  })

  test('text-field without v-model', () => {
    const lines = getSwiftLines(`<text-field placeholder="Search" />`)
    expect(lines.some(l => l.includes('.constant("")'))).toBe(true)
  })
})
