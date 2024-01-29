import { append, insert, normalizeBlock, prepend, remove } from '../src/dom'
import { type Fragment, type ParentBlock, fragmentKey } from '../src/render'

const node1 = document.createTextNode('node1')
const node2 = document.createTextNode('node2')
const node3 = document.createTextNode('node3')
const anchor = document.createTextNode('anchor')

describe('dom', () => {
  test('normalizeBlock', () => {
    expect(normalizeBlock([node1, node2, node3])).toEqual([node1, node2, node3])
    expect(normalizeBlock([node1, [node2, [node3]]])).toEqual([
      node1,
      node2,
      node3,
    ])
    expect(
      normalizeBlock([
        node1,
        { nodes: node2, anchor, [fragmentKey]: true },
        [node3],
      ]),
    ).toEqual([node1, node2, anchor, node3])
  })

  describe('insert', () => {
    test('parent is node', () => {
      const container = document.createElement('div')
      insert([anchor], container)
      insert([node1], container)
      insert([node2], container, anchor)
      insert([], container, node3)
      expect(Array.from(container.childNodes)).toEqual([node2, anchor, node1])

      expect(() => insert(node3, container, node3)).toThrowError(
        'The child can not be found in the parent.',
      )
    })

    test('parent is array', () => {
      const container: Node[] = []
      insert(anchor, container)
      insert({ nodes: node1, [fragmentKey]: true }, container)
      insert([node2], container, anchor)
      expect(container).toEqual([
        [node2],
        anchor,
        { nodes: node1, [fragmentKey]: true },
      ])

      expect(() => insert([], container, node3)).toThrowError(
        'The child can not be found in the parent.',
      )
      expect(() => insert(node3, container, node3)).toThrowError(
        'The child can not be found in the parent.',
      )
    })
  })

  describe('prepend', () => {
    test('parent is node', () => {
      const container = document.createElement('div')
      prepend(container, [node1], node2)
      prepend(container, { nodes: node3, [fragmentKey]: true })
      expect(Array.from(container.childNodes)).toEqual([node3, node1, node2])
    })

    test('parent is array', () => {
      const container: Node[] = []
      prepend(container, [node1], node2)
      prepend(container, { nodes: node3, [fragmentKey]: true })
      expect(container).toEqual([
        { nodes: node3, [fragmentKey]: true },
        [node1],
        node2,
      ])
    })
  })

  describe('append', () => {
    test('parent is node', () => {
      const container = document.createElement('div')
      append(container, [node1], node2)
      append(container, { nodes: node3, [fragmentKey]: true })
      expect(Array.from(container.childNodes)).toEqual([node1, node2, node3])
    })

    test('parent is array', () => {
      const container: Node[] = []
      append(container, [node1], node2)
      append(container, { nodes: node3, [fragmentKey]: true })
      expect(container).toEqual([
        [node1],
        node2,
        { nodes: node3, [fragmentKey]: true },
      ])
    })
  })

  describe('remove', () => {
    test('parent is node', () => {
      const container = document.createElement('div')
      container.append(node1, node2, node3)
      remove([node1], container)
      remove({ nodes: node3, [fragmentKey]: true }, container)
      expect(Array.from(container.childNodes)).toEqual([node2])

      expect(() => remove(anchor, container)).toThrowError(
        'The node to be removed is not a child of this node.',
      )
    })

    test('parent is array', () => {
      const n1 = [node1]
      const n3: Fragment = { nodes: node3, [fragmentKey]: true }
      const container: ParentBlock = [n1, node2, n3]

      remove(n1, container)
      remove(n3, container)
      expect(container).toEqual([node2])

      expect(() => remove(anchor, container)).toThrowError(
        'The node to be removed is not a child of this node.',
      )
    })
  })
})
