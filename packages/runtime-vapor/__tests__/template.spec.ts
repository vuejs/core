/**
 * @vitest-environment jsdom
 */

import { template } from '../src'

describe('api: template', () => {
  test('create element', () => {
    const t = template('<div>')
    const div = t()
    expect(div).toBeInstanceOf(HTMLDivElement)

    const div2 = t()
    expect(div2).toBeInstanceOf(HTMLDivElement)
    expect(div2).not.toBe(div)
  })
})
