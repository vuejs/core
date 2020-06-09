import { createStaticVNode, h, render } from '../src'

describe('static vnode handling', () => {
  const content = `<div>hello</div><p>world</p>`
  const content2 = `<p>foo</p><div>bar</div><span>baz</span>`

  const s = createStaticVNode(content, 2)
  const s2 = createStaticVNode(content2, 3)

  test('should mount from string', () => {
    const root = document.createElement('div')
    render(h('div', [s]), root)
    expect(root.innerHTML).toBe(`<div>${content}</div>`)
  })

  test('should support reusing the same hoisted node', () => {
    const root = document.createElement('div')
    render(h('div', [s, s]), root)
    expect(root.innerHTML).toBe(`<div>${content}${content}</div>`)
  })

  // the rest only happens during HMR but needs to be correctly supported
  test('should update', () => {
    const root = document.createElement('div')
    render(h('div', [s]), root)
    expect(root.innerHTML).toBe(`<div>${content}</div>`)
    render(h('div', [s2]), root)
    expect(root.innerHTML).toBe(`<div>${content2}</div>`)
  })

  test('should move', () => {
    const root = document.createElement('div')
    render(h('div', [h('b'), s, h('b')]), root)
    expect(root.innerHTML).toBe(`<div><b></b>${content}<b></b></div>`)
    render(h('div', [s, h('b'), h('b')]), root)
    expect(root.innerHTML).toBe(`<div>${content}<b></b><b></b></div>`)
    render(h('div', [h('b'), h('b'), s]), root)
    expect(root.innerHTML).toBe(`<div><b></b><b></b>${content}</div>`)
  })

  test('should remove', () => {
    const root = document.createElement('div')
    render(h('div', [h('b'), s, h('b')]), root)
    expect(root.innerHTML).toBe(`<div><b></b>${content}<b></b></div>`)
    render(h('div', [h('b'), h('b')]), root)
    expect(root.innerHTML).toBe(`<div><b></b><b></b></div>`)
    render(h('div', [h('b'), h('b'), s]), root)
    expect(root.innerHTML).toBe(`<div><b></b><b></b>${content}</div>`)
  })
})
