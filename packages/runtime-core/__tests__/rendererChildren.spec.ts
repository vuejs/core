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

    render(h('div', { id: 1 }, [1, 2, 3].map(toSpan)), root)
    elm = root.children[0] as TestElement
    expect(elm.children.length).toBe(3)
    expect(serialize(elm.children[1])).toBe('<span>2</span>')
    expect(serialize(elm.children[2])).toBe('<span>3</span>')
  })

  test('prepend', () => {
    render(h('div', [4, 5].map(toSpan)), root)
    let elm = root.children[0] as TestElement
    expect(elm.children.length).toBe(2)

    render(h('div', [1, 2, 3, 4, 5].map(toSpan)), root)
    elm = root.children[0] as TestElement
    expect(elm.children.length).toBe(5)
    expect((elm.children as TestElement[]).map(c => serializeInner(c))).toEqual(
      ['1', '2', '3', '4', '5']
    )
  })

  test('insert in middle', () => {
    render(h('div', [1, 2, 4, 5].map(toSpan)), root)
    let elm = root.children[0] as TestElement
    expect(elm.children.length).toBe(4)

    render(h('div', [1, 2, 3, 4, 5].map(toSpan)), root)
    elm = root.children[0] as TestElement
    expect(elm.children.length).toBe(5)
    expect((elm.children as TestElement[]).map(c => serializeInner(c))).toEqual(
      ['1', '2', '3', '4', '5']
    )
  })

  test('insert at beginning and end', () => {
    render(h('div', [2, 3, 4].map(toSpan)), root)
    let elm = root.children[0] as TestElement
    expect(elm.children.length).toBe(3)

    render(h('div', [1, 2, 3, 4, 5].map(toSpan)), root)
    elm = root.children[0] as TestElement
    expect(elm.children.length).toBe(5)
    expect((elm.children as TestElement[]).map(c => serializeInner(c))).toEqual(
      ['1', '2', '3', '4', '5']
    )
  })

  test('insert to empty parent', () => {
    render(h('div'), root)
    let elm = root.children[0] as TestElement
    expect(elm.children.length).toBe(0)

    render(h('div', [1, 2, 3, 4, 5].map(toSpan)), root)
    elm = root.children[0] as TestElement
    expect(elm.children.length).toBe(5)
    expect((elm.children as TestElement[]).map(c => serializeInner(c))).toEqual(
      ['1', '2', '3', '4', '5']
    )
  })

  test('remove all children from parent', () => {
    render(h('div', [1, 2, 3, 4, 5].map(toSpan)), root)
    let elm = root.children[0] as TestElement
    expect(elm.children.length).toBe(5)
    expect((elm.children as TestElement[]).map(c => serializeInner(c))).toEqual(
      ['1', '2', '3', '4', '5']
    )

    render(h('div'), root)
    elm = root.children[0] as TestElement
    expect(elm.children.length).toBe(0)
  })

  test('remove from beginning', () => {
    render(h('div', [1, 2, 3, 4, 5].map(toSpan)), root)
    let elm = root.children[0] as TestElement
    expect(elm.children.length).toBe(5)

    render(h('div', [3, 4, 5].map(toSpan)), root)
    elm = root.children[0] as TestElement
    expect(elm.children.length).toBe(3)
    expect((elm.children as TestElement[]).map(c => serializeInner(c))).toEqual(
      ['3', '4', '5']
    )
  })

  test('remove from end', () => {
    render(h('div', [1, 2, 3, 4, 5].map(toSpan)), root)
    let elm = root.children[0] as TestElement
    expect(elm.children.length).toBe(5)

    render(h('div', [1, 2, 3].map(toSpan)), root)
    elm = root.children[0] as TestElement
    expect(elm.children.length).toBe(3)
    expect((elm.children as TestElement[]).map(c => serializeInner(c))).toEqual(
      ['1', '2', '3']
    )
  })

  test('remove from middle', () => {
    render(h('div', [1, 2, 3, 4, 5].map(toSpan)), root)
    let elm = root.children[0] as TestElement
    expect(elm.children.length).toBe(5)

    render(h('div', [1, 2, 4, 5].map(toSpan)), root)
    elm = root.children[0] as TestElement
    expect(elm.children.length).toBe(4)
    expect((elm.children as TestElement[]).map(c => serializeInner(c))).toEqual(
      ['1', '2', '4', '5']
    )
  })

  test('moving single child forward', () => {
    render(h('div', [1, 2, 3, 4].map(toSpan)), root)
    let elm = root.children[0] as TestElement
    expect(elm.children.length).toBe(4)

    render(h('div', [2, 3, 1, 4].map(toSpan)), root)
    elm = root.children[0] as TestElement
    expect(elm.children.length).toBe(4)
    expect((elm.children as TestElement[]).map(c => serializeInner(c))).toEqual(
      ['2', '3', '1', '4']
    )
  })

  test('moving single child backwards', () => {
    render(h('div', [1, 2, 3, 4].map(toSpan)), root)
    let elm = root.children[0] as TestElement
    expect(elm.children.length).toBe(4)

    render(h('div', [1, 4, 2, 3].map(toSpan)), root)
    elm = root.children[0] as TestElement
    expect(elm.children.length).toBe(4)
    expect((elm.children as TestElement[]).map(c => serializeInner(c))).toEqual(
      ['1', '4', '2', '3']
    )
  })

  test('moving single child to end', () => {
    render(h('div', [1, 2, 3].map(toSpan)), root)
    let elm = root.children[0] as TestElement
    expect(elm.children.length).toBe(3)

    render(h('div', [2, 3, 1].map(toSpan)), root)
    elm = root.children[0] as TestElement
    expect(elm.children.length).toBe(3)
    expect((elm.children as TestElement[]).map(c => serializeInner(c))).toEqual(
      ['2', '3', '1']
    )
  })

  test('swap first and last', () => {
    render(h('div', [1, 2, 3, 4].map(toSpan)), root)
    let elm = root.children[0] as TestElement
    expect(elm.children.length).toBe(4)

    render(h('div', [4, 2, 3, 1].map(toSpan)), root)
    elm = root.children[0] as TestElement
    expect(elm.children.length).toBe(4)
    expect((elm.children as TestElement[]).map(c => serializeInner(c))).toEqual(
      ['4', '2', '3', '1']
    )
  })

  test('move to left & replace', () => {
    render(h('div', [1, 2, 3, 4, 5].map(toSpan)), root)
    let elm = root.children[0] as TestElement
    expect(elm.children.length).toBe(5)

    render(h('div', [4, 1, 2, 3, 6].map(toSpan)), root)
    elm = root.children[0] as TestElement
    expect(elm.children.length).toBe(5)
    expect((elm.children as TestElement[]).map(c => serializeInner(c))).toEqual(
      ['4', '1', '2', '3', '6']
    )
  })

  test.todo('shift with offset')

  test.todo('generic reorder')

  test.todo('should not de-opt when both head and tail change')
})

describe('renderer: unkeyed children', () => {})
