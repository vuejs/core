import {
  NodeOpTypes,
  type TestElement,
  TestNodeTypes,
  type TestText,
  dumpOps,
  h,
  nextTick,
  nodeOps,
  reactive,
  ref,
  render,
  resetOps,
  serialize,
  triggerEvent,
} from '../src'

describe('test renderer', () => {
  it('should work', () => {
    const root = nodeOps.createElement('div')
    render(
      h(
        'div',
        {
          id: 'test',
        },
        'hello',
      ),
      root,
    )

    expect(root.children.length).toBe(1)

    const el = root.children[0] as TestElement
    expect(el.type).toBe(TestNodeTypes.ELEMENT)
    expect(el.props.id).toBe('test')
    expect(el.children.length).toBe(1)

    const text = el.children[0] as TestText
    expect(text.type).toBe(TestNodeTypes.TEXT)
    expect(text.text).toBe('hello')
  })

  it('should record ops', async () => {
    const state = reactive({
      id: 'test',
      text: 'hello',
    })

    const App = {
      render() {
        return h(
          'div',
          {
            id: state.id,
          },
          state.text,
        )
      },
    }
    const root = nodeOps.createElement('div')

    resetOps()
    render(h(App), root)
    const ops = dumpOps()

    expect(ops.length).toBe(4)

    expect(ops[0]).toEqual({
      type: NodeOpTypes.CREATE,
      nodeType: TestNodeTypes.ELEMENT,
      tag: 'div',
      targetNode: root.children[0],
    })

    expect(ops[1]).toEqual({
      type: NodeOpTypes.SET_ELEMENT_TEXT,
      text: 'hello',
      targetNode: root.children[0],
    })

    expect(ops[2]).toEqual({
      type: NodeOpTypes.PATCH,
      targetNode: root.children[0],
      propKey: 'id',
      propPrevValue: null,
      propNextValue: 'test',
    })

    expect(ops[3]).toEqual({
      type: NodeOpTypes.INSERT,
      targetNode: root.children[0],
      parentNode: root,
      refNode: null,
    })

    // test update ops
    state.id = 'foo'
    state.text = 'bar'
    await nextTick()

    const updateOps = dumpOps()
    expect(updateOps.length).toBe(2)

    expect(updateOps[0]).toEqual({
      type: NodeOpTypes.SET_ELEMENT_TEXT,
      targetNode: root.children[0],
      text: 'bar',
    })

    expect(updateOps[1]).toEqual({
      type: NodeOpTypes.PATCH,
      targetNode: root.children[0],
      propKey: 'id',
      propPrevValue: 'test',
      propNextValue: 'foo',
    })
  })

  it('should be able to serialize nodes', () => {
    const App = {
      render() {
        return h(
          'div',
          {
            id: 'test',
            boolean: '',
          },
          [h('span', 'foo'), 'hello'],
        )
      },
    }
    const root = nodeOps.createElement('div')
    render(h(App), root)
    expect(serialize(root)).toEqual(
      `<div><div id="test" boolean><span>foo</span>hello</div></div>`,
    )
    // indented output
    expect(serialize(root, 2)).toEqual(
      `<div>
  <div id="test" boolean>
    <span>
      foo
    </span>
    hello
  </div>
</div>`,
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
          },
        },
        count.value,
      )
    }

    const root = nodeOps.createElement('div')
    render(h(App), root)
    triggerEvent(root.children[0] as TestElement, 'click')
    expect(count.value).toBe(1)
    await nextTick()
    expect(serialize(root)).toBe(`<div><span>1</span></div>`)
  })

  it('should be able to trigger events with multiple listeners', async () => {
    const count = ref(0)
    const count2 = ref(1)

    const App = () => {
      return h(
        'span',
        {
          onClick: [
            () => {
              count.value++
            },
            () => {
              count2.value++
            },
          ],
        },
        `${count.value}, ${count2.value}`,
      )
    }

    const root = nodeOps.createElement('div')
    render(h(App), root)
    triggerEvent(root.children[0] as TestElement, 'click')
    expect(count.value).toBe(1)
    expect(count2.value).toBe(2)
    await nextTick()
    expect(serialize(root)).toBe(`<div><span>1, 2</span></div>`)
  })

  it('should mock warn', () => {
    console.warn('warn!!!')
    expect('warn!!!').toHaveBeenWarned()
    expect('warn!!!').toHaveBeenWarnedTimes(1)

    console.warn('warn!!!')
    expect('warn!!!').toHaveBeenWarnedTimes(2)

    console.warn('warning')
    expect('warn!!!').toHaveBeenWarnedTimes(2)
    expect('warning').toHaveBeenWarnedLast()
  })
})
