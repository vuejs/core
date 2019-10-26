import { nodeOps, render, h, serialize, Text, VNode } from '@vue/runtime-test'

describe('renderer: element', () => {
  test('simple', () => {
    const root = nodeOps.createElement('div')

    render(h('div'), root)

    expect(serialize(root)).toMatchSnapshot()
  })

  test('with props', () => {
    const root = nodeOps.createElement('div')
    let id = 'test1'

    render(
      h('div', {
        id
      }),
      root
    )
    expect(serialize(root)).toMatchSnapshot()

    id = 'test2'

    render(
      h('div', {
        id
      }),
      root
    )
    expect(serialize(root)).toMatchSnapshot()
  })

  test('with direct text children', () => {
    const root = nodeOps.createElement('div')
    let text = 'Hello, world!'

    render(h('div', text), root)
    expect(serialize(root)).toMatchSnapshot()

    text = 'I ❤ Vue'

    render(h('div', text), root)
    expect(serialize(root)).toMatchSnapshot()
  })

  test('with text node children', () => {
    const root = nodeOps.createElement('div')

    render(h('div', [h(Text, ['I ❤ Vue'])]), root)

    expect(serialize(root)).toMatchSnapshot()
  })

  test('handle already mounted VNode', () => {
    const root = nodeOps.createElement('div')
    const vnode = h('test')
    const tree1 = h('div', vnode)
    const tree2 = h('div', vnode)

    render(tree1, root)
    expect(serialize(root)).toMatchSnapshot()
    expect((tree1.children as VNode[])[0]).toMatchObject(vnode)

    render(tree2, root)
    expect(serialize(root)).toMatchSnapshot()
    expect((tree2.children as VNode[])[0]).toMatchObject(vnode)
  })
})
