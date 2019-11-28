import { h, render, Text } from '@vue/runtime-dom'

describe('renderer: element', () => {
  test('with props', () => {
    const root = document.createElement('div')

    render(
      h('div', {
        id: 'test',
        class: 'c1',
        style: { color: 'red' }
      }),
      root
    )

    const node = root.children[0] as HTMLElement

    expect(node.tagName).toBe('DIV')
    expect(node.getAttribute('id')).toBe('test')
    expect(node.getAttribute('class')).toBe('c1')
    expect(node.style.color).toBe('red')
  })

  test('with direct text children', () => {
    const root = document.createElement('div')

    render(h('div', 'foo'), root)

    const node = root.children[0] as HTMLElement

    expect(node.textContent).toBe('foo')
  })

  test('with text node children', () => {
    const root = document.createElement('div')

    render(h('div', null, h(Text, null, 'foo')), root)

    const node = root.children[0] as HTMLElement

    expect(node.textContent).toBe('foo')
  })

  test('patch already mounted VNode', () => {
    const root = document.createElement('div')

    render(h('div', 'foo'), root)
    // patch
    render(h('div', 'baz'), root)

    const node = root.children[0] as HTMLElement
    expect(node.textContent).toBe('baz')
  })
})
