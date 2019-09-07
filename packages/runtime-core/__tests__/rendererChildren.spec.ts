// reference: https://github.com/vuejs/vue/blob/dev/test/unit/modules/vdom/patch/children.spec.js
import {
  h,
  render,
  nodeOps,
  TestElement,
  serialize,
  serializeInner
} from '@vue/runtime-test'

function toSpan(content: any) {
  if (typeof content === 'string') {
    return h('span', content.toString())
  } else {
    return h('span', { key: content }, content.toString())
  }
}

it('should patch previously empty children', () => {
  const root = nodeOps.createElement('div')

  render(h('div', []), root)
  expect(serializeInner(root)).toBe('<div></div>')

  render(h('div', ['hello']), root)
  expect(serializeInner(root)).toBe('<div>hello</div>')
})

it('should patch previously null children', () => {
  const root = nodeOps.createElement('div')

  render(h('div'), root)
  expect(serializeInner(root)).toBe('<div></div>')

  render(h('div', ['hello']), root)
  expect(serializeInner(root)).toBe('<div>hello</div>')
})

describe('renderer: keyed children', () => {
  const root = nodeOps.createElement('div')

  beforeEach(() => {
    render(h('div', { id: 1 }, 'hello'), root)
  })

  test('append', () => {
    render(h('div', { id: 1 }, [1].map(toSpan)), root)
    let elm = root.children[0] as TestElement
    expect(elm.children.length).toBe(1)

    render(h('div', { id: 1 }, [5, 6, 7].map(toSpan)), root)
    elm = root.children[0] as TestElement
    expect(elm.children.length).toBe(3)
  })

  test.todo('prepend')

  test.todo('insert in middle')

  test.todo('insert at beginning and end')

  test.todo('insert to empty parent')

  test.todo('shift with offset')

  test.todo('remove from beginning')

  test.todo('remove from end')

  test.todo('remove from middle')

  test.todo('moving single child forward')

  test.todo('moving single child backwards')

  test.todo('moving single child to end')

  test.todo('swap first and last')

  test.todo('move to left & replace')

  test.todo('generic reorder')

  test.todo('should not de-opt when both head and tail change')
})

describe('renderer: unkeyed children', () => {})
