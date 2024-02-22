import { template } from '../src'

describe('api: template', () => {
  test('create element', () => {
    const t = template('<div>')
    const root = t()
    expect(root).toBeInstanceOf(HTMLDivElement)

    const root2 = t()
    expect(root2).toBeInstanceOf(HTMLDivElement)
    expect(root2).not.toBe(root)
  })
})
