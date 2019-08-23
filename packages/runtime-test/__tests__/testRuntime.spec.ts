import {
  h,
  render,
  nodeOps,
  NodeTypes,
  TestElement,
  TestText,
  ref,
  reactive,
  dumpOps,
  resetOps,
  NodeOpTypes,
  nextTick,
  serialize,
  triggerEvent
} from '../src'

describe('test renderer', () => {
  it('should work', () => {
    const root = nodeOps.createElement('div')
    render(
      h(
        'div',
        {
          id: 'test'
        },
        'hello'
      ),
      root
    )

    expect(root.children.length).toBe(1)

    const el = root.children[0] as TestElement
    expect(el.type).toBe(NodeTypes.ELEMENT)
    expect(el.props.id).toBe('test')
    expect(el.children.length).toBe(1)

    const text = el.children[0] as TestText
    expect(text.type).toBe(NodeTypes.TEXT)
    expect(text.text).toBe('hello')
  })

  it('should record ops', async () => {
    const state = reactive({
      id: 'test',
      text: 'hello'
    })

    const App = {
      render() {
        return h(
          'div',
          {
            id: state.id
          },
          state.text
        )
      }
    }
    const root = nodeOps.createElement('div')

    resetOps()
    render(h(App), root)
    const ops = dumpOps()

    expect(ops.length).toBe(4)

    expect(ops[0]).toEqual({
      type: NodeOpTypes.CREATE,
      nodeType: NodeTypes.ELEMENT,
      tag: 'div',
      targetNode: root.children[0]
    })

    expect(ops[1]).toEqual({
      type: NodeOpTypes.PATCH,
      targetNode: root.children[0],
      propKey: 'id',
      propPrevValue: null,
      propNextValue: 'test'
    })

    expect(ops[2]).toEqual({
      type: NodeOpTypes.SET_ELEMENT_TEXT,
      text: 'hello',
      targetNode: root.children[0]
    })

    expect(ops[3]).toEqual({
      type: NodeOpTypes.INSERT,
      targetNode: root.children[0],
      parentNode: root,
      refNode: null
    })

    // test update ops
    state.id = 'foo'
    state.text = 'bar'
    await nextTick()

    const updateOps = dumpOps()
    expect(updateOps.length).toBe(2)

    expect(updateOps[0]).toEqual({
      type: NodeOpTypes.PATCH,
      targetNode: root.children[0],
      propKey: 'id',
      propPrevValue: 'test',
      propNextValue: 'foo'
    })

    expect(updateOps[1]).toEqual({
      type: NodeOpTypes.SET_ELEMENT_TEXT,
      targetNode: root.children[0],
      text: 'bar'
    })
  })

  it('should be able to serialize nodes', () => {
    const App = {
      render() {
        return h(
          'div',
          {
            id: 'test'
          },
          [h('span', 'foo'), 'hello']
        )
      }
    }
    const root = nodeOps.createElement('div')
    render(h(App), root)
    expect(serialize(root)).toEqual(
      `<div><div id="test"><span>foo</span>hello</div></div>`
    )
    // indented output
    expect(serialize(root, 2)).toEqual(
      `<div>
  <div id="test">
    <span>
      foo
    </span>
    hello
  </div>
</div>`
    )
  })

  it('should be able to trigger events', async () => {
    const count = ref(0)

    const App = () => {
      return h(
        'span',
        {
          onClick: () => {
            count.value++
          }
        },
        count.value
      )
    }

    const root = nodeOps.createElement('div')
    render(h(App), root)
    triggerEvent(root.children[0] as TestElement, 'click')
    expect(count.value).toBe(1)
    await nextTick()
    expect(serialize(root)).toBe(`<div><span>1</span></div>`)
  })
})
