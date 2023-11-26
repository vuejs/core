/**
 * @vitest-environment jsdom
 */

import { template, fragment } from '../src'

describe('api: template', () => {
  test('create element', () => {
    const t = template('<div>')
    const root = t()
    expect(root).toBeInstanceOf(DocumentFragment)
    expect(root.childNodes[0]).toBeInstanceOf(HTMLDivElement)

    const div2 = t()
    expect(div2).toBeInstanceOf(DocumentFragment)
    expect(div2).not.toBe(root)
  })

  test('create fragment', () => {
    const frag = fragment()
    const root = frag()
    expect(root).toBeInstanceOf(DocumentFragment)
    expect(root.childNodes.length).toBe(0)

    const div2 = frag()
    expect(div2).toBeInstanceOf(DocumentFragment)
    expect(div2).not.toBe(root)
  })
})
