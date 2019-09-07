// reference: https://github.com/vuejs/vue/blob/dev/test/unit/modules/vdom/patch/children.spec.js

import {
  h,
  nodeOps,
  TestElement,
  render,
  serializeInner
} from '@vue/runtime-test'

describe('renderer: unkeyed children', () => {
  const App = {
    // @ts-ignore
    render() {
      // @ts-ignore
      return h('ul', this.$slots.default())
    }
  }

  let root: TestElement

  function renderChildren(items: number[]) {
    return render(
      h(App, {}, { default: () => items.map(item => h('li', item)) }),
      root
    )
  }

  beforeEach(() => {
    root = nodeOps.createElement('div')
  })

  test('append', () => {
    const items = [2, 4]
    renderChildren(items)
    expect(serializeInner(root)).toBe('<ul><li>2</li><li>4</li></ul>')

    items.push(5)
    renderChildren(items)
    expect(serializeInner(root)).toBe('<ul><li>2</li><li>4</li><li>5</li></ul>')
  })

  test('prepend', () => {
    const items = [2, 4]
    renderChildren(items)
    expect(serializeInner(root)).toBe('<ul><li>2</li><li>4</li></ul>')

    items.unshift(1)
    renderChildren(items)
    expect(serializeInner(root)).toBe('<ul><li>1</li><li>2</li><li>4</li></ul>')
  })

  test('insert in middle', () => {
    const items = [2, 4]
    renderChildren(items)
    expect(serializeInner(root)).toBe('<ul><li>2</li><li>4</li></ul>')

    items.splice(1, 0, 3)
    renderChildren(items)
    expect(serializeInner(root)).toBe('<ul><li>2</li><li>3</li><li>4</li></ul>')
  })

  test('insert at beginning and end', () => {
    const items = [2, 4]
    renderChildren(items)
    expect(serializeInner(root)).toBe('<ul><li>2</li><li>4</li></ul>')

    items.unshift(1)
    items.push(5)
    renderChildren(items)
    expect(serializeInner(root)).toBe(
      '<ul><li>1</li><li>2</li><li>4</li><li>5</li></ul>'
    )
  })

  test('insert to empty parent', () => {
    const items: number[] = []
    renderChildren(items)
    expect(serializeInner(root)).toBe('<ul></ul>')

    items.unshift(1)
    renderChildren(items)
    expect(serializeInner(root)).toBe('<ul><li>1</li></ul>')
  })

  test.todo('shift with offset')

  test('remove from beginning', () => {
    const items = [2, 4]
    renderChildren(items)
    expect(serializeInner(root)).toBe('<ul><li>2</li><li>4</li></ul>')

    items.shift()
    renderChildren(items)
    expect(serializeInner(root)).toBe('<ul><li>4</li></ul>')
  })

  test('remove from end', () => {
    const items = [2, 4]
    renderChildren(items)
    expect(serializeInner(root)).toBe('<ul><li>2</li><li>4</li></ul>')

    items.pop()
    renderChildren(items)
    expect(serializeInner(root)).toBe('<ul><li>2</li></ul>')
  })

  test('remove from middle', () => {
    const items = [2, 3, 4]
    renderChildren(items)
    expect(serializeInner(root)).toBe('<ul><li>2</li><li>3</li><li>4</li></ul>')

    items.splice(1, 1)
    renderChildren(items)
    expect(serializeInner(root)).toBe('<ul><li>2</li><li>4</li></ul>')
  })

  test.todo('moving single child forward')

  test.todo('moving single child backwards')

  test.todo('moving single child to end')

  test.todo('swap first and last')

  test.todo('move to left & replace')

  test.todo('generic reorder')

  test.todo('should not de-opt when both head and tail change')
})

describe('renderer: keyed children', () => {})
