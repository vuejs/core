import {
  h,
  render,
  Component,
  nodeOps,
  NodeTypes,
  TestElement,
  TestText,
  dumpOps,
  NodeOpTypes,
  nextTick,
  observable,
  resetOps,
  serialize
} from '../src'

describe('test renderer', () => {
  it('should work', () => {
    class App extends Component {
      render() {
        return h(
          'div',
          {
            id: 'test'
          },
          'hello'
        )
      }
    }
    const root = nodeOps.createElement('div')
    render(h(App), root)

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
    const state = observable({
      id: 'test',
      text: 'hello'
    })

    class App extends Component {
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

    expect(ops.length).toBe(5)

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
      type: NodeOpTypes.CREATE,
      nodeType: NodeTypes.TEXT,
      text: 'hello',
      targetNode: (root.children[0] as TestElement).children[0]
    })

    expect(ops[3]).toEqual({
      type: NodeOpTypes.APPEND,
      targetNode: (root.children[0] as TestElement).children[0],
      parentNode: root.children[0]
    })

    expect(ops[4]).toEqual({
      type: NodeOpTypes.APPEND,
      targetNode: root.children[0],
      parentNode: root
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
      type: NodeOpTypes.SET_TEXT,
      targetNode: (root.children[0] as TestElement).children[0],
      text: 'bar'
    })
  })

  it('should be able to serialize nodes', () => {
    class App extends Component {
      render() {
        return h(
          'div',
          {
            id: 'test'
          },
          'hello'
        )
      }
    }
    const root = nodeOps.createElement('div')
    render(h(App), root)
    expect(serialize(root)).toEqual(`<div><div id="test">hello</div></div>`)
    expect(serialize(root, 2)).toEqual(
      `<div>
  <div id="test">
    hello
  </div>
</div>`
    )
  })
})
