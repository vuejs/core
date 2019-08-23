import {
  h,
  createVNode,
  render,
  nodeOps,
  NodeTypes,
  TestElement,
  serialize,
  Fragment,
  reactive,
  nextTick,
  PatchFlags,
  resetOps,
  dumpOps,
  NodeOpTypes
} from '@vue/runtime-test'

describe('vdom: fragment', () => {
  it('should allow returning multiple component root nodes', () => {
    const App = {
      render() {
        return [h('div', 'one'), 'two']
      }
    }

    const root = nodeOps.createElement('div')
    render(h(App), root)

    expect(serialize(root)).toBe(`<div><!----><div>one</div>two<!----></div>`)
    expect(root.children.length).toBe(4)
    expect(root.children[0]).toMatchObject({
      type: NodeTypes.COMMENT
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
      type: NodeTypes.COMMENT
    })
  })

  it('explicitly create fragments', () => {
    const App = {
      render() {
        return h('div', [h(Fragment, [h('div', 'one'), 'two'])])
      }
    }
    const root = nodeOps.createElement('div')
    render(h(App), root)
    const parent = root.children[0] as TestElement
    expect(serialize(parent)).toBe(`<div><!----><div>one</div>two<!----></div>`)
  })

  it('patch fragment children (manual, keyed)', async () => {
    const state = reactive({ ok: true })
    const App = {
      render() {
        return state.ok
          ? [h('div', { key: 1 }, 'one'), h('div', { key: 2 }, 'two')]
          : [h('div', { key: 2 }, 'two'), h('div', { key: 1 }, 'one')]
      }
    }
    const root = nodeOps.createElement('div')
    render(h(App), root)

    expect(serialize(root)).toBe(
      `<div><!----><div>one</div><div>two</div><!----></div>`
    )

    resetOps()
    state.ok = false
    await nextTick()
    expect(serialize(root)).toBe(
      `<div><!----><div>two</div><div>one</div><!----></div>`
    )
    const ops = dumpOps()
    // should be moving nodes instead of re-creating or patching them
    expect(ops).toMatchObject([
      {
        type: NodeOpTypes.INSERT
      }
    ])
  })

  it('patch fragment children (manual, unkeyed)', async () => {
    const state = reactive({ ok: true })
    const App = {
      render() {
        return state.ok
          ? [h('div', 'one'), h('div', 'two')]
          : [h('div', 'two'), h('div', 'one')]
      }
    }
    const root = nodeOps.createElement('div')
    render(h(App), root)

    expect(serialize(root)).toBe(
      `<div><!----><div>one</div><div>two</div><!----></div>`
    )

    resetOps()
    state.ok = false
    await nextTick()
    expect(serialize(root)).toBe(
      `<div><!----><div>two</div><div>one</div><!----></div>`
    )
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

  it('patch fragment children (compiler generated, unkeyed)', async () => {
    const state = reactive({ ok: true })
    const App = {
      render() {
        return state.ok
          ? createVNode(
              Fragment,
              0,
              [h('div', 'one'), 'two'],
              PatchFlags.UNKEYED
            )
          : createVNode(
              Fragment,
              0,
              [h('div', 'foo'), 'bar', 'baz'],
              PatchFlags.UNKEYED
            )
      }
    }
    const root = nodeOps.createElement('div')
    render(h(App), root)

    expect(serialize(root)).toBe(`<div><!----><div>one</div>two<!----></div>`)

    state.ok = false
    await nextTick()
    expect(serialize(root)).toBe(
      `<div><!----><div>foo</div>barbaz<!----></div>`
    )
  })

  it('patch fragment children (compiler generated, keyed)', async () => {
    const state = reactive({ ok: true })
    const App = {
      render() {
        return state.ok
          ? createVNode(
              Fragment,
              0,
              [h('div', { key: 1 }, 'one'), h('div', { key: 2 }, 'two')],
              PatchFlags.KEYED
            )
          : createVNode(
              Fragment,
              0,
              [h('div', { key: 2 }, 'two'), h('div', { key: 1 }, 'one')],
              PatchFlags.KEYED
            )
      }
    }
    const root = nodeOps.createElement('div')
    render(h(App), root)

    expect(serialize(root)).toBe(
      `<div><!----><div>one</div><div>two</div><!----></div>`
    )

    resetOps()
    state.ok = false
    await nextTick()
    expect(serialize(root)).toBe(
      `<div><!----><div>two</div><div>one</div><!----></div>`
    )
    const ops = dumpOps()
    // should be moving nodes instead of re-creating or patching them
    expect(ops).toMatchObject([
      {
        type: NodeOpTypes.INSERT
      }
    ])
  })

  it('move fragment', async () => {
    const state = reactive({ ok: true })
    const App = {
      render() {
        return state.ok
          ? h('div', [
              h('div', { key: 1 }, 'outer'),
              h(Fragment, { key: 2 }, [
                h('div', { key: 1 }, 'one'),
                h('div', { key: 2 }, 'two')
              ])
            ])
          : h('div', [
              h(Fragment, { key: 2 }, [
                h('div', { key: 2 }, 'two'),
                h('div', { key: 1 }, 'one')
              ]),
              h('div', { key: 1 }, 'outer')
            ])
      }
    }
    const root = nodeOps.createElement('div')
    render(h(App), root)
    const parent = root.children[0] as TestElement

    expect(serialize(parent)).toBe(
      `<div><div>outer</div><!----><div>one</div><div>two</div><!----></div>`
    )

    resetOps()
    state.ok = false
    await nextTick()
    expect(serialize(parent)).toBe(
      `<div><!----><div>two</div><div>one</div><!----><div>outer</div></div>`
    )
    const ops = dumpOps()
    // should be moving nodes instead of re-creating them
    expect(ops).toMatchObject([
      // 1. re-order inside the fragment
      { type: NodeOpTypes.INSERT, targetNode: { type: 'element' } },
      // 2. move entire fragment, including anchors
      // not the most efficient move, but this case is super rare
      // and optimizing for this special case complicates the algo quite a bit
      { type: NodeOpTypes.INSERT, targetNode: { type: 'comment' } },
      { type: NodeOpTypes.INSERT, targetNode: { type: 'element' } },
      { type: NodeOpTypes.INSERT, targetNode: { type: 'element' } },
      { type: NodeOpTypes.INSERT, targetNode: { type: 'comment' } }
    ])
  })

  it('handle nested fragments', async () => {
    const state = reactive({ ok: true })
    const App = {
      render() {
        return state.ok
          ? [
              h('div', { key: 1 }, 'outer'),
              h(Fragment, { key: 2 }, [
                h('div', { key: 1 }, 'one'),
                h('div', { key: 2 }, 'two')
              ])
            ]
          : [
              h(Fragment, { key: 2 }, [
                h('div', { key: 2 }, 'two'),
                h('div', { key: 1 }, 'one')
              ]),
              h('div', { key: 1 }, 'outer')
            ]
      }
    }

    const root = nodeOps.createElement('div')
    render(h(App), root)

    expect(serialize(root)).toBe(
      `<div><!----><div>outer</div><!----><div>one</div><div>two</div><!----><!----></div>`
    )

    resetOps()
    state.ok = false
    await nextTick()
    expect(serialize(root)).toBe(
      `<div><!----><!----><div>two</div><div>one</div><!----><div>outer</div><!----></div>`
    )
    const ops = dumpOps()
    // should be moving nodes instead of re-creating them
    expect(ops).toMatchObject([
      { type: NodeOpTypes.INSERT, targetNode: { type: 'element' } },
      { type: NodeOpTypes.INSERT, targetNode: { type: 'comment' } },
      { type: NodeOpTypes.INSERT, targetNode: { type: 'element' } },
      { type: NodeOpTypes.INSERT, targetNode: { type: 'element' } },
      { type: NodeOpTypes.INSERT, targetNode: { type: 'comment' } }
    ])
  })
})
