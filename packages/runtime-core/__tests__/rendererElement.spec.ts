import { nodeOps, render, h, serialize, Text } from '@vue/runtime-test'

describe('renderer: element', () => {
  test('simple', () => {
    const root = nodeOps.createElement('div')

    render(h('div'), root)

    expect(serialize(root)).toMatchSnapshot()
  })

  test('with props', () => {
    const root = nodeOps.createElement('div')

    render(
      h('div', {
        id: 'test'
      }),
      root
    )

    expect(serialize(root)).toMatchSnapshot()
  })

  test('with direct text children', () => {
    const root = nodeOps.createElement('div')

    render(h('div', 'I ❤ Vue'), root)

    expect(serialize(root)).toMatchSnapshot()
  })

  test('with text node children', () => {
    const root = nodeOps.createElement('div')

    render(h('div', [h(Text, ['I ❤ Vue'])]), root)

    expect(serialize(root)).toMatchSnapshot()
  })

  test('handle already mounted VNode', () => {
    const root1 = nodeOps.createElement('div')
    const root2 = nodeOps.createElement('div')
    const vnode = h('div')

    render(vnode, root1)
    expect(vnode.el).toBe(root1.children[0])

    render(vnode, root2)
    expect(vnode.el).toBe(root2.children[0])

    expect(serialize(root1)).toMatchSnapshot('root 1')
    expect(serialize(root2)).toMatchSnapshot('root 2')
  })
})
