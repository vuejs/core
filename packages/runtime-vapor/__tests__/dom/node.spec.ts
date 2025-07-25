import { createTextNode, normalizeNode } from '../../src/dom/node'

describe('dom node', () => {
  test('normalizeNode', () => {
    // null / undefined -> Comment
    expect(normalizeNode(null)).toBeInstanceOf(Comment)
    expect(normalizeNode(undefined)).toBeInstanceOf(Comment)

    // boolean -> Comment
    expect(normalizeNode(true)).toBeInstanceOf(Comment)
    expect(normalizeNode(false)).toBeInstanceOf(Comment)

    // ['foo'] -> [TextNode]
    expect(normalizeNode(['foo'])).toMatchObject(createTextNode('foo'))

    // primitive types
    expect(normalizeNode('foo')).toMatchObject(createTextNode('foo'))
    expect(normalizeNode(1)).toMatchObject(createTextNode('1'))
  })
})
