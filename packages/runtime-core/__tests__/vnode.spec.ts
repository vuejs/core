import { createVNode, cloneVNode } from '../src/vnode'

describe('vnode', () => {
  test.todo('create with just tag')

  test.todo('create with tag and props')

  test.todo('create with tag, props and children')

  test.todo('create with 0 as props')

  test.todo('class normalization')

  test.todo('style normalization')

  test.todo('children normalization')

  test.todo('normalizeVNode')

  test.todo('node type/shapeFlag inference')

  test('cloneNode', () => {
    const node1 = createVNode('div', { foo: 1 }, null)
    expect(cloneVNode(node1)).toEqual(node1)

    const node2 = createVNode('div', null, [node1])
    expect(cloneVNode(node2)).toEqual(node2)

    let node = null
    for (let i = 1; i <= 100; ++i) {
      node = createVNode('div', null, [node])
      expect(cloneVNode(node)).toEqual(node)
    }
  })

  test.todo('mergeProps')
})
