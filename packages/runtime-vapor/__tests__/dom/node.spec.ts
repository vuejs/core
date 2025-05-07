import { createTextNode, normalizeNode } from '../../src/dom/node'
import { VaporFragment } from '../../src'

describe('dom node', () => {
  test('normalizeNode', () => {
    // null / undefined -> Comment
    expect(normalizeNode(null)).toBeInstanceOf(Comment)
    expect(normalizeNode(undefined)).toBeInstanceOf(Comment)

    // boolean -> Comment
    expect(normalizeNode(true)).toBeInstanceOf(Comment)
    expect(normalizeNode(false)).toBeInstanceOf(Comment)

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
