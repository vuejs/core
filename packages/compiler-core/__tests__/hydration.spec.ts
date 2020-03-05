import {
  createSSRApp,
  h,
  ref,
  nextTick,
  VNode,
  Portal,
  createStaticVNode
} from '@vue/runtime-dom'

function mountWithHydration(html: string, render: () => any) {
  const container = document.createElement('div')
  container.innerHTML = html
  const app = createSSRApp({
    render
  })
  return {
    vnode: app.mount(container).$.subTree,
    container
  }
}

const triggerEvent = (type: string, el: Element) => {
  const event = new Event(type)
  el.dispatchEvent(event)
}

describe('SSR hydration', () => {
  test('text', async () => {
    const msg = ref('foo')
    const { vnode, container } = mountWithHydration('foo', () => msg.value)
    expect(vnode.el).toBe(container.firstChild)
    expect(container.textContent).toBe('foo')
    msg.value = 'bar'
    await nextTick()
    expect(container.textContent).toBe('bar')
  })

  test('comment', () => {
    const { vnode, container } = mountWithHydration('<!---->', () => null)
    expect(vnode.el).toBe(container.firstChild)
    expect(vnode.el.nodeType).toBe(8) // comment
  })

  test('static', () => {
    const html = '<div><span>hello</span></div>'
    const { vnode, container } = mountWithHydration(html, () =>
      createStaticVNode(html)
    )
    expect(vnode.el).toBe(container.firstChild)
    expect(vnode.el.outerHTML).toBe(html)
  })

  test('element with text children', async () => {
    const msg = ref('foo')
    const { vnode, container } = mountWithHydration(
      '<div class="foo">foo</div>',
      () => h('div', { class: msg.value }, msg.value)
    )
    expect(vnode.el).toBe(container.firstChild)
    expect(container.firstChild!.textContent).toBe('foo')
    msg.value = 'bar'
    await nextTick()
    expect(container.innerHTML).toBe(`<div class="bar">bar</div>`)
  })

  test('element with elements children', async () => {
    const msg = ref('foo')
    const fn = jest.fn()
    const { vnode, container } = mountWithHydration(
      '<div><span>foo</span><span class="foo"></span></div>',
      () =>
        h('div', [
          h('span', msg.value),
          h('span', { class: msg.value, onClick: fn })
        ])
    )
    expect(vnode.el).toBe(container.firstChild)
    expect((vnode.children as VNode[])[0].el).toBe(
      container.firstChild!.childNodes[0]
    )
    expect((vnode.children as VNode[])[1].el).toBe(
      container.firstChild!.childNodes[1]
    )

    // event handler
    triggerEvent('click', vnode.el.querySelector('.foo'))
    expect(fn).toHaveBeenCalled()

    msg.value = 'bar'
    await nextTick()
    expect(vnode.el.innerHTML).toBe(`<span>bar</span><span class="bar"></span>`)
  })

  test('fragment', async () => {
    const msg = ref('foo')
    const fn = jest.fn()
    const { vnode, container } = mountWithHydration(
      '<div><span>foo</span><span class="foo"></span></div>',
      () =>
        h('div', [
          [h('span', msg.value), [h('span', { class: msg.value, onClick: fn })]]
        ])
    )
    expect(vnode.el).toBe(container.firstChild)

    // start fragment 1
    const fragment1 = (vnode.children as VNode[])[0]
    expect(fragment1.el).toBe(vnode.el.childNodes[0])
    const fragment1Children = fragment1.children as VNode[]

    // first <span>
    expect(fragment1Children[0].el.tagName).toBe('SPAN')
    expect(fragment1Children[0].el).toBe(vnode.el.childNodes[1])

    // start fragment 2
    const fragment2 = fragment1Children[1]
    expect(fragment2.el).toBe(vnode.el.childNodes[2])
    const fragment2Children = fragment2.children as VNode[]

    // second <span>
    expect(fragment2Children[0].el.tagName).toBe('SPAN')
    expect(fragment2Children[0].el).toBe(vnode.el.childNodes[3])

    // end fragment 2
    expect(fragment2.anchor).toBe(vnode.el.childNodes[4])

    // end fragment 1
    expect(fragment1.anchor).toBe(vnode.el.childNodes[5])

    // event handler
    triggerEvent('click', vnode.el.querySelector('.foo'))
    expect(fn).toHaveBeenCalled()

    msg.value = 'bar'
    await nextTick()
    expect(vnode.el.innerHTML).toBe(`<span>bar</span><span class="bar"></span>`)
  })

  test('portal', async () => {
    const msg = ref('foo')
    const fn = jest.fn()
    const portalContainer = document.createElement('div')
    portalContainer.id = 'portal'
    portalContainer.innerHTML = `<span>foo</span><span class="foo"></span>`
    document.body.appendChild(portalContainer)

    const { vnode, container } = mountWithHydration('<!--portal-->', () =>
      h(Portal, { target: '#portal' }, [
        h('span', msg.value),
        h('span', { class: msg.value, onClick: fn })
      ])
    )

    expect(vnode.el).toBe(container.firstChild)
    expect((vnode.children as VNode[])[0].el).toBe(
      portalContainer.childNodes[0]
    )
    expect((vnode.children as VNode[])[1].el).toBe(
      portalContainer.childNodes[1]
    )

    // event handler
    triggerEvent('click', portalContainer.querySelector('.foo')!)
    expect(fn).toHaveBeenCalled()

    msg.value = 'bar'
    await nextTick()
    expect(portalContainer.innerHTML).toBe(
      `<span>bar</span><span class="bar"></span>`
    )
  })

  // compile SSR + client render fn from the same template & hydrate
  test('full compiler integration', () => {})

  describe('mismatch handling', () => {
    test('text', () => {})

    test('not enough children', () => {})

    test('too many children', () => {})

    test('complete mismatch', () => {})
  })
})
