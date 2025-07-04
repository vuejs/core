import { createTextNode, normalizeNode } from '../../src/dom/node'
import { VaporFragment } from '../../src'

describe('dom node', () => {
  test('normalizeNode', () => {
    // null / undefined -> []
    expect(normalizeNode(null)).toBeInstanceOf(Array)
    expect(normalizeNode(undefined)).toBeInstanceOf(Array)

    // boolean -> []
    expect(normalizeNode(true)).toBeInstanceOf(Array)
    expect(normalizeNode(false)).toBeInstanceOf(Array)

    // array -> Fragment
    expect(normalizeNode(['foo'])).toBeInstanceOf(VaporFragment)

    // VNode -> VNode
    const vnode = createTextNode('div')
    expect(normalizeNode(vnode)).toBe(vnode)

    // primitive types
    expect(normalizeNode('foo')).toMatchObject(createTextNode('foo'))
    expect(normalizeNode(1)).toMatchObject(createTextNode('1'))
  })
})
