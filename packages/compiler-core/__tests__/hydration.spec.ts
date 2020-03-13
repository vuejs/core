import {
  createSSRApp,
  h,
  ref,
  nextTick,
  VNode,
  Portal,
  createStaticVNode
} from '@vue/runtime-dom'
import { renderToString } from '@vue/server-renderer'
import { mockWarn } from '@vue/shared'

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
      '<div><!--[--><span>foo</span><!--[--><span class="foo"></span><!--]--><!--]--></div>',
      () =>
        h('div', [
          [h('span', msg.value), [h('span', { class: msg.value, onClick: fn })]]
        ])
    )
    expect(vnode.el).toBe(container.firstChild)

    // should remove anchors in dev mode
    expect(vnode.el.innerHTML).toBe(`<span>foo</span><span class="foo"></span>`)

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
  test('full compiler integration', async () => {
    const mounted: string[] = []
    const log = jest.fn()
    const toggle = ref(true)

    const Child = {
      data() {
        return {
          count: 0,
          text: 'hello',
          style: {
            color: 'red'
          }
        }
      },
      mounted() {
        mounted.push('child')
      },
      template: `
      <div>
        <span class="count" :style="style">{{ count }}</span>
        <button class="inc" @click="count++">inc</button>
        <button class="change" @click="style.color = 'green'" >change color</button>
        <button class="emit" @click="$emit('foo')">emit</button>
        <span class="text">{{ text }}</span>
        <input v-model="text">
      </div>
      `
    }

    const App = {
      setup() {
        return { toggle }
      },
      mounted() {
        mounted.push('parent')
      },
      template: `
        <div>
          <span>hello</span>
          <template v-if="toggle">
            <Child @foo="log('child')"/>
            <template v-if="true">
              <button class="parent-click" @click="log('click')">click me</button>
            </template>
          </template>
          <span>hello</span>
        </div>`,
      components: {
        Child
      },
      methods: {
        log
      }
    }

    const container = document.createElement('div')
    // server render
    container.innerHTML = await renderToString(h(App))
    // hydrate
    createSSRApp(App).mount(container)

    // assert interactions
    // 1. parent button click
    triggerEvent('click', container.querySelector('.parent-click')!)
    expect(log).toHaveBeenCalledWith('click')

    // 2. child inc click + text interpolation
    const count = container.querySelector('.count') as HTMLElement
    expect(count.textContent).toBe(`0`)
    triggerEvent('click', container.querySelector('.inc')!)
    await nextTick()
    expect(count.textContent).toBe(`1`)

    // 3. child color click + style binding
    expect(count.style.color).toBe('red')
    triggerEvent('click', container.querySelector('.change')!)
    await nextTick()
    expect(count.style.color).toBe('green')

    // 4. child event emit
    triggerEvent('click', container.querySelector('.emit')!)
    expect(log).toHaveBeenCalledWith('child')

    // 5. child v-model
    const text = container.querySelector('.text')!
    const input = container.querySelector('input')!
    expect(text.textContent).toBe('hello')
    input.value = 'bye'
    triggerEvent('input', input)
    await nextTick()
    expect(text.textContent).toBe('bye')
  })

  describe('mismatch handling', () => {
    mockWarn()

    test('text node', () => {
      const { container } = mountWithHydration(`foo`, () => 'bar')
      expect(container.textContent).toBe('bar')
      expect(`Hydration text mismatch`).toHaveBeenWarned()
    })

    test('element text content', () => {
      const { container } = mountWithHydration(`<div>foo</div>`, () =>
        h('div', 'bar')
      )
      expect(container.innerHTML).toBe('<div>bar</div>')
      expect(`Hydration text content mismatch in <div>`).toHaveBeenWarned()
    })

    test('not enough children', () => {
      const { container } = mountWithHydration(`<div></div>`, () =>
        h('div', [h('span', 'foo'), h('span', 'bar')])
      )
      expect(container.innerHTML).toBe(
        '<div><span>foo</span><span>bar</span></div>'
      )
      expect(`Hydration children mismatch in <div>`).toHaveBeenWarned()
    })

    test('too many children', () => {
      const { container } = mountWithHydration(
        `<div><span>foo</span><span>bar</span></div>`,
        () => h('div', [h('span', 'foo')])
      )
      expect(container.innerHTML).toBe('<div><span>foo</span></div>')
      expect(`Hydration children mismatch in <div>`).toHaveBeenWarned()
    })

    test('complete mismatch', () => {
      const { container } = mountWithHydration(
        `<div><span>foo</span><span>bar</span></div>`,
        () => h('div', [h('div', 'foo'), h('p', 'bar')])
      )
      expect(container.innerHTML).toBe('<div><div>foo</div><p>bar</p></div>')
      expect(`Hydration node mismatch`).toHaveBeenWarnedTimes(2)
    })
  })
})
