import { insert, normalizeBlock, prepend, remove } from '../../src/dom/element'
import { fragmentKey } from '../../src/apiRender'

const node1 = document.createTextNode('node1')
const node2 = document.createTextNode('node2')
const node3 = document.createTextNode('node3')
const anchor = document.createTextNode('anchor')

describe('element', () => {
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

  test('insert', () => {
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

  test('prepend', () => {
    const container = document.createElement('div')
    prepend(container, [node1], node2)
    prepend(container, { nodes: node3, [fragmentKey]: true })
    expect(Array.from(container.childNodes)).toEqual([node3, node1, node2])
  })

  test('remove', () => {
    const container = document.createElement('div')
    container.append(node1, node2, node3)
    remove([node1], container)
    remove({ nodes: node3, [fragmentKey]: true }, container)
    expect(Array.from(container.childNodes)).toEqual([node2])

    expect(() => remove(anchor, container)).toThrowError(
      'The node to be removed is not a child of this node.',
    )
  })
})
