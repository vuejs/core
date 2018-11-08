import {
  h,
  Component,
  render,
  nodeOps,
  NodeTypes,
  TestElement,
  Fragment,
  observable,
  serialize,
  ChildrenFlags,
  nextTick,
  resetOps,
  dumpOps,
  NodeOpTypes,
  renderInstance
} from '@vue/runtime-test'

describe('Fragments', () => {
  it('should allow returning multiple component root nodes', async () => {
    class App extends Component {
      render() {
        return [h('div', 'one'), 'two']
      }
    }
    const root = nodeOps.createElement('div')
    await renderInstance(App)
    expect(serialize(root)).toBe(`<div><div>one</div>two</div>`)
    expect(root.children.length).toBe(2)
    expect(root.children[0]).toMatchObject({
      type: NodeTypes.ELEMENT,
      tag: 'div'
    })
    expect((root.children[0] as TestElement).children[0]).toMatchObject({
      type: NodeTypes.TEXT,
      text: 'one'
    })
    expect(root.children[1]).toMatchObject({
      type: NodeTypes.TEXT,
      text: 'two'
    })
  })

  it('should be able to explicitly create fragments', async () => {
    class App extends Component {
      render() {
        return h('div', [h(Fragment, [h('div', 'one'), 'two'])])
      }
    }
    const root = nodeOps.createElement('div')
    await render(h(App), root)
    const parent = root.children[0] as TestElement
    expect(serialize(parent)).toBe(`<div><div>one</div>two</div>`)
  })

  it('should be able to patch fragment children (unkeyed)', async () => {
    const state = observable({ ok: true })
    class App extends Component {
      render() {
        return state.ok
          ? h.f([h('div', 'one'), h.t('two')], ChildrenFlags.NONE_KEYED_VNODES)
          : h.f(
              [h('div', 'foo'), h.t('bar'), h.t('baz')],
              ChildrenFlags.NONE_KEYED_VNODES
            )
      }
    }
    const root = nodeOps.createElement('div')
    await render(h(App), root)

    expect(serialize(root)).toBe(`<div><div>one</div>two</div>`)

    state.ok = false
    await nextTick()
    expect(serialize(root)).toBe(`<div><div>foo</div>barbaz</div>`)
  })

  it('should be able to patch fragment children (implicitly keyed)', async () => {
    const state = observable({ ok: true })
    class App extends Component {
      render() {
        return state.ok
          ? [h('div', 'one'), 'two']
          : [h('pre', 'foo'), 'bar', 'baz']
      }
    }
    const root = nodeOps.createElement('div')
    await await render(h(App), root)

    expect(serialize(root)).toBe(`<div><div>one</div>two</div>`)

    state.ok = false
    await nextTick()
    expect(serialize(root)).toBe(`<div><pre>foo</pre>barbaz</div>`)
  })

  it('should be able to patch fragment children (explcitly keyed)', async () => {
    const state = observable({ ok: true })
    class App extends Component {
      render() {
        return state.ok
          ? [h('div', { key: 1 }, 'one'), h('div', { key: 2 }, 'two')]
          : [h('div', { key: 2 }, 'two'), h('div', { key: 1 }, 'one')]
      }
    }
    const root = nodeOps.createElement('div')
    await render(h(App), root)

    expect(serialize(root)).toBe(`<div><div>one</div><div>two</div></div>`)

    resetOps()
    state.ok = false
    await nextTick()
    expect(serialize(root)).toBe(`<div><div>two</div><div>one</div></div>`)
    const ops = dumpOps()
    // should be moving nodes instead of re-creating them
    expect(ops.some(op => op.type === NodeOpTypes.CREATE)).toBe(false)
  })

  it('should be able to move fragment', async () => {
    const state = observable({ ok: true })
    class App extends Component {
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
    await render(h(App), root)
    const parent = root.children[0] as TestElement

    expect(serialize(parent)).toBe(
      `<div><div>outer</div><div>one</div><div>two</div></div>`
    )

    resetOps()
    state.ok = false
    await nextTick()
    expect(serialize(parent)).toBe(
      `<div><div>two</div><div>one</div><div>outer</div></div>`
    )
    const ops = dumpOps()
    // should be moving nodes instead of re-creating them
    expect(ops.some(op => op.type === NodeOpTypes.CREATE)).toBe(false)
  })

  it('should be able to handle nested fragments', async () => {
    const state = observable({ ok: true })
    class App extends Component {
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
    await render(h(App), root)

    expect(serialize(root)).toBe(
      `<div><div>outer</div><div>one</div><div>two</div></div>`
    )

    resetOps()
    state.ok = false
    await nextTick()
    expect(serialize(root)).toBe(
      `<div><div>two</div><div>one</div><div>outer</div></div>`
    )
    const ops = dumpOps()
    // should be moving nodes instead of re-creating them
    expect(ops.some(op => op.type === NodeOpTypes.CREATE)).toBe(false)
  })
})
