import { template } from '../src'

describe('api: template', () => {
  test('create element', () => {
    const t = template('<div>')
    const root = t()
    expect(root).toBeInstanceOf(Array)
    expect(root[0]).toBeInstanceOf(HTMLDivElement)

    const root2 = t()
    expect(root2).toBeInstanceOf(Array)
    expect(root2).not.toBe(root)
  })
})
