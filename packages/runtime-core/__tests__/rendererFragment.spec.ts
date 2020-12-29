import {
  h,
  createVNode,
  render,
  nodeOps,
  NodeTypes,
  TestElement,
  Fragment,
  resetOps,
  dumpOps,
  NodeOpTypes,
  serializeInner,
  createTextVNode,
  createBlock,
  openBlock,
  createCommentVNode
} from '@vue/runtime-test'
import { PatchFlags } from '@vue/shared'
import { renderList } from '../src/helpers/renderList'

describe('renderer: fragment', () => {
  it('should allow returning multiple component root nodes', () => {
    const App = {
      render() {
        return [h('div', 'one'), 'two']
      }
    }

    const root = nodeOps.createElement('div')
    render(h(App), root)

    expect(serializeInner(root)).toBe(`<div>one</div>two`)
    expect(root.children.length).toBe(4)
    expect(root.children[0]).toMatchObject({
      type: NodeTypes.TEXT,
      text: ''
    })
    expect(root.children[1]).toMatchObject({
      type: NodeTypes.ELEMENT,
      tag: 'div'
    })
    expect((root.children[1] as TestElement).children[0]).toMatchObject({
      type: NodeTypes.TEXT,
      text: 'one'
    })
    expect(root.children[2]).toMatchObject({
      type: NodeTypes.TEXT,
      text: 'two'
    })
    expect(root.children[3]).toMatchObject({
      type: NodeTypes.TEXT,
      text: ''
    })
  })

  it('explicitly create fragments', () => {
    const root = nodeOps.createElement('div')
    render(h('div', [h(Fragment, [h('div', 'one'), 'two'])]), root)
    const parent = root.children[0] as TestElement
    expect(serializeInner(parent)).toBe(`<div>one</div>two`)
  })

  it('patch fragment children (manual, keyed)', () => {
    const root = nodeOps.createElement('div')
    render(
      h(Fragment, [h('div', { key: 1 }, 'one'), h('div', { key: 2 }, 'two')]),
      root
    )
    expect(serializeInner(root)).toBe(`<div>one</div><div>two</div>`)

    resetOps()
    render(
      h(Fragment, [h('div', { key: 2 }, 'two'), h('div', { key: 1 }, 'one')]),
      root
    )
    expect(serializeInner(root)).toBe(`<div>two</div><div>one</div>`)
    const ops = dumpOps()
    // should be moving nodes instead of re-creating or patching them
    expect(ops).toMatchObject([
      {
        type: NodeOpTypes.INSERT
      }
    ])
  })

  it('patch fragment children (manual, unkeyed)', () => {
    const root = nodeOps.createElement('div')
    render(h(Fragment, [h('div', 'one'), h('div', 'two')]), root)
    expect(serializeInner(root)).toBe(`<div>one</div><div>two</div>`)

    resetOps()
    render(h(Fragment, [h('div', 'two'), h('div', 'one')]), root)
    expect(serializeInner(root)).toBe(`<div>two</div><div>one</div>`)
    const ops = dumpOps()
    // should be patching nodes instead of moving or re-creating them
    expect(ops).toMatchObject([
      {
        type: NodeOpTypes.SET_ELEMENT_TEXT
      },
      {
        type: NodeOpTypes.SET_ELEMENT_TEXT
      }
    ])
  })

  it('patch fragment children (compiler generated, unkeyed)', () => {
    const root = nodeOps.createElement('div')
    render(
      createVNode(
        Fragment,
        null,
        [
          createVNode('div', null, 'one', PatchFlags.TEXT),
          createTextVNode('two')
        ],
        PatchFlags.UNKEYED_FRAGMENT
      ),
      root
    )
    expect(serializeInner(root)).toBe(`<div>one</div>two`)

    render(
      createVNode(
        Fragment,
        null,
        [
          createVNode('div', null, 'foo', PatchFlags.TEXT),
          createTextVNode('bar'),
          createTextVNode('baz')
        ],
        PatchFlags.UNKEYED_FRAGMENT
      ),
      root
    )
    expect(serializeInner(root)).toBe(`<div>foo</div>barbaz`)

    render(
      createVNode(
        Fragment,
        null,
        [
          createTextVNode('baz'),
          createVNode('div', null, 'foo', PatchFlags.TEXT)
        ],
        PatchFlags.UNKEYED_FRAGMENT
      ),
      root
    )
    expect(serializeInner(root)).toBe(`baz<div>foo</div>`)
  })

  it('patch fragment children (compiler generated, keyed)', () => {
    const root = nodeOps.createElement('div')

    render(
      createVNode(
        Fragment,
        null,
        [h('div', { key: 1 }, 'one'), h('div', { key: 2 }, 'two')],
        PatchFlags.KEYED_FRAGMENT
      ),
      root
    )
    expect(serializeInner(root)).toBe(`<div>one</div><div>two</div>`)

    resetOps()
    render(
      createVNode(
        Fragment,
        null,
        [h('div', { key: 2 }, 'two'), h('div', { key: 1 }, 'one')],
        PatchFlags.KEYED_FRAGMENT
      ),
      root
    )
    expect(serializeInner(root)).toBe(`<div>two</div><div>one</div>`)
    const ops = dumpOps()
    // should be moving nodes instead of re-creating or patching them
    expect(ops).toMatchObject([
      {
        type: NodeOpTypes.INSERT
      }
    ])
  })

  it('move fragment', () => {
    const root = nodeOps.createElement('div')
    render(
      h('div', [
        h('div', { key: 1 }, 'outer'),
        h(Fragment, { key: 2 }, [
          h('div', { key: 1 }, 'one'),
          h('div', { key: 2 }, 'two')
        ])
      ]),
      root
    )
    expect(serializeInner(root)).toBe(
      `<div><div>outer</div><div>one</div><div>two</div></div>`
    )

    resetOps()
    render(
      h('div', [
        h(Fragment, { key: 2 }, [
          h('div', { key: 2 }, 'two'),
          h('div', { key: 1 }, 'one')
        ]),
        h('div', { key: 1 }, 'outer')
      ]),
      root
    )
    expect(serializeInner(root)).toBe(
      `<div><div>two</div><div>one</div><div>outer</div></div>`
    )
    const ops = dumpOps()
    // should be moving nodes instead of re-creating them
    expect(ops).toMatchObject([
      // 1. re-order inside the fragment
      { type: NodeOpTypes.INSERT, targetNode: { type: 'element' } },
      // 2. move entire fragment, including anchors
      // not the most efficient move, but this case is super rare
      // and optimizing for this special case complicates the algo quite a bit
      { type: NodeOpTypes.INSERT, targetNode: { type: 'text', text: '' } },
      { type: NodeOpTypes.INSERT, targetNode: { type: 'element' } },
      { type: NodeOpTypes.INSERT, targetNode: { type: 'element' } },
      { type: NodeOpTypes.INSERT, targetNode: { type: 'text', text: '' } }
    ])
  })

  it('handle nested fragments', () => {
    const root = nodeOps.createElement('div')

    render(
      h(Fragment, [
        h('div', { key: 1 }, 'outer'),
        h(Fragment, { key: 2 }, [
          h('div', { key: 1 }, 'one'),
          h('div', { key: 2 }, 'two')
        ])
      ]),
      root
    )
    expect(serializeInner(root)).toBe(
      `<div>outer</div><div>one</div><div>two</div>`
    )

    resetOps()
    render(
      h(Fragment, [
        h(Fragment, { key: 2 }, [
          h('div', { key: 2 }, 'two'),
          h('div', { key: 1 }, 'one')
        ]),
        h('div', { key: 1 }, 'outer')
      ]),
      root
    )
    expect(serializeInner(root)).toBe(
      `<div>two</div><div>one</div><div>outer</div>`
    )
    const ops = dumpOps()
    // should be moving nodes instead of re-creating them
    expect(ops).toMatchObject([
      { type: NodeOpTypes.INSERT, targetNode: { type: 'element' } },
      { type: NodeOpTypes.INSERT, targetNode: { type: 'text', text: '' } },
      { type: NodeOpTypes.INSERT, targetNode: { type: 'element' } },
      { type: NodeOpTypes.INSERT, targetNode: { type: 'element' } },
      { type: NodeOpTypes.INSERT, targetNode: { type: 'text', text: '' } }
    ])

    // should properly remove nested fragments
    render(null, root)
    expect(serializeInner(root)).toBe(``)
  })

  // #2080
  test('`template` keyed fragment w/ comment + hoisted node', () => {
    const root = nodeOps.createElement('div')
    const hoisted = h('span')

    const renderFn = (items: string[]) => {
      return (
        openBlock(true),
        createBlock(
          Fragment,
          null,
          renderList(items, item => {
            return (
              openBlock(),
              createBlock(
                Fragment,
                { key: item },
                [
                  createCommentVNode('comment'),
                  hoisted,
                  createVNode('div', null, item, PatchFlags.TEXT)
                ],
                PatchFlags.STABLE_FRAGMENT
              )
            )
          }),
          PatchFlags.KEYED_FRAGMENT
        )
      )
    }

    render(renderFn(['one', 'two']), root)
    expect(serializeInner(root)).toBe(
      `<!--comment--><span></span><div>one</div><!--comment--><span></span><div>two</div>`
    )

    render(renderFn(['two', 'one']), root)
    expect(serializeInner(root)).toBe(
      `<!--comment--><span></span><div>two</div><!--comment--><span></span><div>one</div>`
    )
  })
})
