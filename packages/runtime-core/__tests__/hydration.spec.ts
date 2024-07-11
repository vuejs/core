/**
 * @vitest-environment jsdom
 */

import {
  type ObjectDirective,
  Suspense,
  Teleport,
  Transition,
  type VNode,
  createBlock,
  createCommentVNode,
  createElementBlock,
  createElementVNode,
  createSSRApp,
  createStaticVNode,
  createTextVNode,
  createVNode,
  defineAsyncComponent,
  defineComponent,
  h,
  nextTick,
  onMounted,
  openBlock,
  ref,
  renderSlot,
  useCssVars,
  vModelCheckbox,
  vShow,
  withCtx,
  withDirectives,
} from '@vue/runtime-dom'
import { type SSRContext, renderToString } from '@vue/server-renderer'
import { PatchFlags } from '@vue/shared'
import { vShowOriginalDisplay } from '../../runtime-dom/src/directives/vShow'
import { expect } from 'vitest'

function mountWithHydration(html: string, render: () => any) {
  const container = document.createElement('div')
  container.innerHTML = html
  const app = createSSRApp({
    render,
  })
  return {
    vnode: app.mount(container).$.subTree as VNode<Node, Element> & {
      el: Element
    },
    container,
  }
}

const triggerEvent = (type: string, el: Element) => {
  const event = new Event(type)
  el.dispatchEvent(event)
}

describe('SSR hydration', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  test('text', async () => {
    const msg = ref('foo')
    const { vnode, container } = mountWithHydration('foo', () => msg.value)
    expect(vnode.el).toBe(container.firstChild)
    expect(container.textContent).toBe('foo')
    msg.value = 'bar'
    await nextTick()
    expect(container.textContent).toBe('bar')
  })

  test('empty text', async () => {
    const { container } = mountWithHydration('<div></div>', () =>
      h('div', createTextVNode('')),
    )
    expect(container.textContent).toBe('')
    expect(`Hydration children mismatch in <div>`).not.toHaveBeenWarned()
  })

  test('comment', () => {
    const { vnode, container } = mountWithHydration('<!---->', () => null)
    expect(vnode.el).toBe(container.firstChild)
    expect(vnode.el.nodeType).toBe(8) // comment
  })

  test('static', () => {
    const html = '<div><span>hello</span></div>'
    const { vnode, container } = mountWithHydration(html, () =>
      createStaticVNode('', 1),
    )
    expect(vnode.el).toBe(container.firstChild)
    expect(vnode.el.outerHTML).toBe(html)
    expect(vnode.anchor).toBe(container.firstChild)
    expect(vnode.children).toBe(html)
  })

  test('static (multiple elements)', () => {
    const staticContent = '<div></div><span>hello</span>'
    const html = `<div><div>hi</div>` + staticContent + `<div>ho</div></div>`

    const n1 = h('div', 'hi')
    const s = createStaticVNode('', 2)
    const n2 = h('div', 'ho')

    const { container } = mountWithHydration(html, () => h('div', [n1, s, n2]))

    const div = container.firstChild!

    expect(n1.el).toBe(div.firstChild)
    expect(n2.el).toBe(div.lastChild)
    expect(s.el).toBe(div.childNodes[1])
    expect(s.anchor).toBe(div.childNodes[2])
    expect(s.children).toBe(staticContent)
  })

  // #6008
  test('static (with text node as starting node)', () => {
    const html = ` A <span>foo</span> B`
    const { vnode, container } = mountWithHydration(html, () =>
      createStaticVNode(` A <span>foo</span> B`, 3),
    )
    expect(vnode.el).toBe(container.firstChild)
    expect(vnode.anchor).toBe(container.lastChild)
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
  })

  test('static with content adoption', () => {
    const html = ` A <span>foo</span> B`
    const { vnode, container } = mountWithHydration(html, () =>
      createStaticVNode(``, 3),
    )
    expect(vnode.el).toBe(container.firstChild)
    expect(vnode.anchor).toBe(container.lastChild)
    expect(vnode.children).toBe(html)
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
  })

  test('element with text children', async () => {
    const msg = ref('foo')
    const { vnode, container } = mountWithHydration(
      '<div class="foo">foo</div>',
      () => h('div', { class: msg.value }, msg.value),
    )
    expect(vnode.el).toBe(container.firstChild)
    expect(container.firstChild!.textContent).toBe('foo')
    msg.value = 'bar'
    await nextTick()
    expect(container.innerHTML).toBe(`<div class="bar">bar</div>`)
  })

  test('element with elements children', async () => {
    const msg = ref('foo')
    const fn = vi.fn()
    const { vnode, container } = mountWithHydration(
      '<div><span>foo</span><span class="foo"></span></div>',
      () =>
        h('div', [
          h('span', msg.value),
          h('span', { class: msg.value, onClick: fn }),
        ]),
    )
    expect(vnode.el).toBe(container.firstChild)
    expect((vnode.children as VNode[])[0].el).toBe(
      container.firstChild!.childNodes[0],
    )
    expect((vnode.children as VNode[])[1].el).toBe(
      container.firstChild!.childNodes[1],
    )

    // event handler
    triggerEvent('click', vnode.el.querySelector('.foo')!)
    expect(fn).toHaveBeenCalled()

    msg.value = 'bar'
    await nextTick()
    expect(vnode.el.innerHTML).toBe(`<span>bar</span><span class="bar"></span>`)
  })

  test('element with ref', () => {
    const el = ref()
    const { vnode, container } = mountWithHydration('<div></div>', () =>
      h('div', { ref: el }),
    )
    expect(vnode.el).toBe(container.firstChild)
    expect(el.value).toBe(vnode.el)
  })

  test('Fragment', async () => {
    const msg = ref('foo')
    const fn = vi.fn()
    const { vnode, container } = mountWithHydration(
      '<div><!--[--><span>foo</span><!--[--><span class="foo"></span><!--]--><!--]--></div>',
      () =>
        h('div', [
          [
            h('span', msg.value),
            [h('span', { class: msg.value, onClick: fn })],
          ],
        ]),
    )
    expect(vnode.el).toBe(container.firstChild)

    expect(vnode.el.innerHTML).toBe(
      `<!--[--><span>foo</span><!--[--><span class="foo"></span><!--]--><!--]-->`,
    )

    // start fragment 1
    const fragment1 = (vnode.children as VNode[])[0]
    expect(fragment1.el).toBe(vnode.el.childNodes[0])
    const fragment1Children = fragment1.children as VNode[]

    // first <span>
    expect(fragment1Children[0].el!.tagName).toBe('SPAN')
    expect(fragment1Children[0].el).toBe(vnode.el.childNodes[1])

    // start fragment 2
    const fragment2 = fragment1Children[1]
    expect(fragment2.el).toBe(vnode.el.childNodes[2])
    const fragment2Children = fragment2.children as VNode[]

    // second <span>
    expect(fragment2Children[0].el!.tagName).toBe('SPAN')
    expect(fragment2Children[0].el).toBe(vnode.el.childNodes[3])

    // end fragment 2
    expect(fragment2.anchor).toBe(vnode.el.childNodes[4])

    // end fragment 1
    expect(fragment1.anchor).toBe(vnode.el.childNodes[5])

    // event handler
    triggerEvent('click', vnode.el.querySelector('.foo')!)
    expect(fn).toHaveBeenCalled()

    msg.value = 'bar'
    await nextTick()
    expect(vnode.el.innerHTML).toBe(
      `<!--[--><span>bar</span><!--[--><span class="bar"></span><!--]--><!--]-->`,
    )
  })

  test('Teleport', async () => {
    const msg = ref('foo')
    const fn = vi.fn()
    const teleportContainer = document.createElement('div')
    teleportContainer.id = 'teleport'
    teleportContainer.innerHTML = `<span>foo</span><span class="foo"></span><!--teleport anchor-->`
    document.body.appendChild(teleportContainer)

    const { vnode, container } = mountWithHydration(
      '<!--teleport start--><!--teleport end-->',
      () =>
        h(Teleport, { to: '#teleport' }, [
          h('span', msg.value),
          h('span', { class: msg.value, onClick: fn }),
        ]),
    )

    expect(vnode.el).toBe(container.firstChild)
    expect(vnode.anchor).toBe(container.lastChild)

    expect(vnode.target).toBe(teleportContainer)
    expect((vnode.children as VNode[])[0].el).toBe(
      teleportContainer.childNodes[0],
    )
    expect((vnode.children as VNode[])[1].el).toBe(
      teleportContainer.childNodes[1],
    )
    expect(vnode.targetAnchor).toBe(teleportContainer.childNodes[2])

    // event handler
    triggerEvent('click', teleportContainer.querySelector('.foo')!)
    expect(fn).toHaveBeenCalled()

    msg.value = 'bar'
    await nextTick()
    expect(teleportContainer.innerHTML).toBe(
      `<span>bar</span><span class="bar"></span><!--teleport anchor-->`,
    )
  })

  test('Teleport (multiple + integration)', async () => {
    const msg = ref('foo')
    const fn1 = vi.fn()
    const fn2 = vi.fn()

    const Comp = () => [
      h(Teleport, { to: '#teleport2' }, [
        h('span', msg.value),
        h('span', { class: msg.value, onClick: fn1 }),
      ]),
      h(Teleport, { to: '#teleport2' }, [
        h('span', msg.value + '2'),
        h('span', { class: msg.value + '2', onClick: fn2 }),
      ]),
    ]

    const teleportContainer = document.createElement('div')
    teleportContainer.id = 'teleport2'
    const ctx: SSRContext = {}
    const mainHtml = await renderToString(h(Comp), ctx)
    expect(mainHtml).toMatchInlineSnapshot(
      `"<!--[--><!--teleport start--><!--teleport end--><!--teleport start--><!--teleport end--><!--]-->"`,
    )

    const teleportHtml = ctx.teleports!['#teleport2']
    expect(teleportHtml).toMatchInlineSnapshot(
      `"<span>foo</span><span class="foo"></span><!--teleport anchor--><span>foo2</span><span class="foo2"></span><!--teleport anchor-->"`,
    )

    teleportContainer.innerHTML = teleportHtml
    document.body.appendChild(teleportContainer)

    const { vnode, container } = mountWithHydration(mainHtml, Comp)
    expect(vnode.el).toBe(container.firstChild)
    const teleportVnode1 = (vnode.children as VNode[])[0]
    const teleportVnode2 = (vnode.children as VNode[])[1]
    expect(teleportVnode1.el).toBe(container.childNodes[1])
    expect(teleportVnode1.anchor).toBe(container.childNodes[2])
    expect(teleportVnode2.el).toBe(container.childNodes[3])
    expect(teleportVnode2.anchor).toBe(container.childNodes[4])

    expect(teleportVnode1.target).toBe(teleportContainer)
    expect((teleportVnode1 as any).children[0].el).toBe(
      teleportContainer.childNodes[0],
    )
    expect(teleportVnode1.targetAnchor).toBe(teleportContainer.childNodes[2])

    expect(teleportVnode2.target).toBe(teleportContainer)
    expect((teleportVnode2 as any).children[0].el).toBe(
      teleportContainer.childNodes[3],
    )
    expect(teleportVnode2.targetAnchor).toBe(teleportContainer.childNodes[5])

    // // event handler
    triggerEvent('click', teleportContainer.querySelector('.foo')!)
    expect(fn1).toHaveBeenCalled()

    triggerEvent('click', teleportContainer.querySelector('.foo2')!)
    expect(fn2).toHaveBeenCalled()

    msg.value = 'bar'
    await nextTick()
    expect(teleportContainer.innerHTML).toMatchInlineSnapshot(
      `"<span>bar</span><span class="bar"></span><!--teleport anchor--><span>bar2</span><span class="bar2"></span><!--teleport anchor-->"`,
    )
  })

  test('Teleport (disabled)', async () => {
    const msg = ref('foo')
    const fn1 = vi.fn()
    const fn2 = vi.fn()

    const Comp = () => [
      h('div', 'foo'),
      h(Teleport, { to: '#teleport3', disabled: true }, [
        h('span', msg.value),
        h('span', { class: msg.value, onClick: fn1 }),
      ]),
      h('div', { class: msg.value + '2', onClick: fn2 }, 'bar'),
    ]

    const teleportContainer = document.createElement('div')
    teleportContainer.id = 'teleport3'
    const ctx: SSRContext = {}
    const mainHtml = await renderToString(h(Comp), ctx)
    expect(mainHtml).toMatchInlineSnapshot(
      `"<!--[--><div>foo</div><!--teleport start--><span>foo</span><span class="foo"></span><!--teleport end--><div class="foo2">bar</div><!--]-->"`,
    )

    const teleportHtml = ctx.teleports!['#teleport3']
    expect(teleportHtml).toMatchInlineSnapshot(`"<!--teleport anchor-->"`)

    teleportContainer.innerHTML = teleportHtml
    document.body.appendChild(teleportContainer)

    const { vnode, container } = mountWithHydration(mainHtml, Comp)
    expect(vnode.el).toBe(container.firstChild)
    const children = vnode.children as VNode[]

    expect(children[0].el).toBe(container.childNodes[1])

    const teleportVnode = children[1]
    expect(teleportVnode.el).toBe(container.childNodes[2])
    expect((teleportVnode.children as VNode[])[0].el).toBe(
      container.childNodes[3],
    )
    expect((teleportVnode.children as VNode[])[1].el).toBe(
      container.childNodes[4],
    )
    expect(teleportVnode.anchor).toBe(container.childNodes[5])
    expect(children[2].el).toBe(container.childNodes[6])

    expect(teleportVnode.target).toBe(teleportContainer)
    expect(teleportVnode.targetAnchor).toBe(teleportContainer.childNodes[0])

    // // event handler
    triggerEvent('click', container.querySelector('.foo')!)
    expect(fn1).toHaveBeenCalled()

    triggerEvent('click', container.querySelector('.foo2')!)
    expect(fn2).toHaveBeenCalled()

    msg.value = 'bar'
    await nextTick()
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<!--[--><div>foo</div><!--teleport start--><span>bar</span><span class="bar"></span><!--teleport end--><div class="bar2">bar</div><!--]-->"`,
    )
  })

  // #6152
  test('Teleport (disabled + as component root)', () => {
    const { container } = mountWithHydration(
      '<!--[--><div>Parent fragment</div><!--teleport start--><div>Teleport content</div><!--teleport end--><!--]-->',
      () => [
        h('div', 'Parent fragment'),
        h(() =>
          h(Teleport, { to: 'body', disabled: true }, [
            h('div', 'Teleport content'),
          ]),
        ),
      ],
    )
    expect(document.body.innerHTML).toBe('')
    expect(container.innerHTML).toBe(
      '<!--[--><div>Parent fragment</div><!--teleport start--><div>Teleport content</div><!--teleport end--><!--]-->',
    )
    expect(
      `Hydration completed but contains mismatches.`,
    ).not.toHaveBeenWarned()
  })

  test('Teleport (as component root)', () => {
    const teleportContainer = document.createElement('div')
    teleportContainer.id = 'teleport4'
    teleportContainer.innerHTML = `hello<!--teleport anchor-->`
    document.body.appendChild(teleportContainer)

    const wrapper = {
      render() {
        return h(Teleport, { to: '#teleport4' }, ['hello'])
      },
    }

    const { vnode, container } = mountWithHydration(
      '<div><!--teleport start--><!--teleport end--><div></div></div>',
      () => h('div', [h(wrapper), h('div')]),
    )
    expect(vnode.el).toBe(container.firstChild)
    // component el
    const wrapperVNode = (vnode as any).children[0]
    const tpStart = container.firstChild?.firstChild
    const tpEnd = tpStart?.nextSibling
    expect(wrapperVNode.el).toBe(tpStart)
    expect(wrapperVNode.component.subTree.el).toBe(tpStart)
    expect(wrapperVNode.component.subTree.anchor).toBe(tpEnd)
    // next node hydrate properly
    const nextVNode = (vnode as any).children[1]
    expect(nextVNode.el).toBe(container.firstChild?.lastChild)
  })

  test('Teleport (nested)', () => {
    const teleportContainer = document.createElement('div')
    teleportContainer.id = 'teleport5'
    teleportContainer.innerHTML = `<div><!--teleport start--><!--teleport end--></div><!--teleport anchor--><div>child</div><!--teleport anchor-->`
    document.body.appendChild(teleportContainer)

    const { vnode, container } = mountWithHydration(
      '<!--teleport start--><!--teleport end-->',
      () =>
        h(Teleport, { to: '#teleport5' }, [
          h('div', [h(Teleport, { to: '#teleport5' }, [h('div', 'child')])]),
        ]),
    )

    expect(vnode.el).toBe(container.firstChild)
    expect(vnode.anchor).toBe(container.lastChild)

    const childDivVNode = (vnode as any).children[0]
    const div = teleportContainer.firstChild
    expect(childDivVNode.el).toBe(div)
    expect(vnode.targetAnchor).toBe(div?.nextSibling)

    const childTeleportVNode = childDivVNode.children[0]
    expect(childTeleportVNode.el).toBe(div?.firstChild)
    expect(childTeleportVNode.anchor).toBe(div?.lastChild)

    expect(childTeleportVNode.targetAnchor).toBe(teleportContainer.lastChild)
    expect(childTeleportVNode.children[0].el).toBe(
      teleportContainer.lastChild?.previousSibling,
    )
  })

  // compile SSR + client render fn from the same template & hydrate
  test('full compiler integration', async () => {
    const mounted: string[] = []
    const log = vi.fn()
    const toggle = ref(true)

    const Child = {
      data() {
        return {
          count: 0,
          text: 'hello',
          style: {
            color: 'red',
          },
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
      `,
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
        Child,
      },
      methods: {
        log,
      },
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

  test('handle click error in ssr mode', async () => {
    const App = {
      setup() {
        const throwError = () => {
          throw new Error('Sentry Error')
        }
        return { throwError }
      },
      template: `
        <div>
          <button class="parent-click" @click="throwError">click me</button>
        </div>`,
    }

    const container = document.createElement('div')
    // server render
    container.innerHTML = await renderToString(h(App))
    // hydrate
    const app = createSSRApp(App)
    const handler = (app.config.errorHandler = vi.fn())
    app.mount(container)
    // assert interactions
    // parent button click
    triggerEvent('click', container.querySelector('.parent-click')!)
    expect(handler).toHaveBeenCalled()
  })

  test('handle blur error in ssr mode', async () => {
    const App = {
      setup() {
        const throwError = () => {
          throw new Error('Sentry Error')
        }
        return { throwError }
      },
      template: `
        <div>
          <input class="parent-click" @blur="throwError"/>
        </div>`,
    }

    const container = document.createElement('div')
    // server render
    container.innerHTML = await renderToString(h(App))
    // hydrate
    const app = createSSRApp(App)
    const handler = (app.config.errorHandler = vi.fn())
    app.mount(container)
    // assert interactions
    // parent blur event
    triggerEvent('blur', container.querySelector('.parent-click')!)
    expect(handler).toHaveBeenCalled()
  })

  test('Suspense', async () => {
    const AsyncChild = {
      async setup() {
        const count = ref(0)
        return () =>
          h(
            'span',
            {
              onClick: () => {
                count.value++
              },
            },
            count.value,
          )
      },
    }
    const { vnode, container } = mountWithHydration('<span>0</span>', () =>
      h(Suspense, () => h(AsyncChild)),
    )
    expect(vnode.el).toBe(container.firstChild)
    // wait for hydration to finish
    await new Promise(r => setTimeout(r))
    triggerEvent('click', container.querySelector('span')!)
    await nextTick()
    expect(container.innerHTML).toBe(`<span>1</span>`)
  })

  test('Suspense (full integration)', async () => {
    const mountedCalls: number[] = []
    const asyncDeps: Promise<any>[] = []

    const AsyncChild = defineComponent({
      props: ['n'],
      async setup(props) {
        const count = ref(props.n)
        onMounted(() => {
          mountedCalls.push(props.n)
        })
        const p = new Promise(r => setTimeout(r, props.n * 10))
        asyncDeps.push(p)
        await p
        return () =>
          h(
            'span',
            {
              onClick: () => {
                count.value++
              },
            },
            count.value,
          )
      },
    })

    const done = vi.fn()
    const App = {
      template: `
      <Suspense @resolve="done">
        <div>
          <AsyncChild :n="1" />
          <AsyncChild :n="2" />
        </div>
      </Suspense>`,
      components: {
        AsyncChild,
      },
      methods: {
        done,
      },
    }

    const container = document.createElement('div')
    // server render
    container.innerHTML = await renderToString(h(App))
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<div><span>1</span><span>2</span></div>"`,
    )
    // reset asyncDeps from ssr
    asyncDeps.length = 0
    // hydrate
    createSSRApp(App).mount(container)

    expect(mountedCalls.length).toBe(0)
    expect(asyncDeps.length).toBe(2)

    // wait for hydration to complete
    await Promise.all(asyncDeps)
    await new Promise(r => setTimeout(r))

    // should flush buffered effects
    expect(mountedCalls).toMatchObject([1, 2])
    expect(container.innerHTML).toMatch(
      `<div><span>1</span><span>2</span></div>`,
    )

    const span1 = container.querySelector('span')!
    triggerEvent('click', span1)
    await nextTick()
    expect(container.innerHTML).toMatch(
      `<div><span>2</span><span>2</span></div>`,
    )

    const span2 = span1.nextSibling as Element
    triggerEvent('click', span2)
    await nextTick()
    expect(container.innerHTML).toMatch(
      `<div><span>2</span><span>3</span></div>`,
    )
  })

  test('async component', async () => {
    const spy = vi.fn()
    const Comp = () =>
      h(
        'button',
        {
          onClick: spy,
        },
        'hello!',
      )

    let serverResolve: any
    let AsyncComp = defineAsyncComponent(
      () =>
        new Promise(r => {
          serverResolve = r
        }),
    )

    const App = {
      render() {
        return ['hello', h(AsyncComp), 'world']
      },
    }

    // server render
    const htmlPromise = renderToString(h(App))
    serverResolve(Comp)
    const html = await htmlPromise
    expect(html).toMatchInlineSnapshot(
      `"<!--[-->hello<button>hello!</button>world<!--]-->"`,
    )

    // hydration
    let clientResolve: any
    AsyncComp = defineAsyncComponent(
      () =>
        new Promise(r => {
          clientResolve = r
        }),
    )

    const container = document.createElement('div')
    container.innerHTML = html
    createSSRApp(App).mount(container)

    // hydration not complete yet
    triggerEvent('click', container.querySelector('button')!)
    expect(spy).not.toHaveBeenCalled()

    // resolve
    clientResolve(Comp)
    await new Promise(r => setTimeout(r))

    // should be hydrated now
    triggerEvent('click', container.querySelector('button')!)
    expect(spy).toHaveBeenCalled()
  })

  test('update async wrapper before resolve', async () => {
    const Comp = {
      render() {
        return h('h1', 'Async component')
      },
    }
    let serverResolve: any
    let AsyncComp = defineAsyncComponent(
      () =>
        new Promise(r => {
          serverResolve = r
        }),
    )

    const toggle = ref(true)
    const App = {
      setup() {
        onMounted(() => {
          // change state, this makes updateComponent(AsyncComp) execute before
          // the async component is resolved
          toggle.value = false
        })

        return () => {
          return [toggle.value ? 'hello' : 'world', h(AsyncComp)]
        }
      },
    }

    // server render
    const htmlPromise = renderToString(h(App))
    serverResolve(Comp)
    const html = await htmlPromise
    expect(html).toMatchInlineSnapshot(
      `"<!--[-->hello<h1>Async component</h1><!--]-->"`,
    )

    // hydration
    let clientResolve: any
    AsyncComp = defineAsyncComponent(
      () =>
        new Promise(r => {
          clientResolve = r
        }),
    )

    const container = document.createElement('div')
    container.innerHTML = html
    createSSRApp(App).mount(container)

    // resolve
    clientResolve(Comp)
    await new Promise(r => setTimeout(r))

    // should be hydrated now
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<!--[-->world<h1>Async component</h1><!--]-->"`,
    )
  })

  test('hydrate safely when property used by async setup changed before render', async () => {
    const toggle = ref(true)

    const AsyncComp = {
      async setup() {
        await new Promise<void>(r => setTimeout(r, 10))
        return () => h('h1', 'Async component')
      },
    }

    const AsyncWrapper = {
      render() {
        return h(AsyncComp)
      },
    }

    const SiblingComp = {
      setup() {
        toggle.value = false
        return () => h('span')
      },
    }

    const App = {
      setup() {
        return () =>
          h(
            Suspense,
            {},
            {
              default: () => [
                h('main', {}, [
                  h(AsyncWrapper, {
                    prop: toggle.value ? 'hello' : 'world',
                  }),
                  h(SiblingComp),
                ]),
              ],
            },
          )
      },
    }

    // server render
    const html = await renderToString(h(App))

    expect(html).toMatchInlineSnapshot(
      `"<main><h1 prop="hello">Async component</h1><span></span></main>"`,
    )

    expect(toggle.value).toBe(false)

    // hydration

    // reset the value
    toggle.value = true
    expect(toggle.value).toBe(true)

    const container = document.createElement('div')
    container.innerHTML = html
    createSSRApp(App).mount(container)

    await new Promise(r => setTimeout(r, 10))

    expect(toggle.value).toBe(false)

    // should be hydrated now
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<main><h1 prop="world">Async component</h1><span></span></main>"`,
    )
  })

  test('hydrate safely when property used by deep nested async setup changed before render', async () => {
    const toggle = ref(true)

    const AsyncComp = {
      async setup() {
        await new Promise<void>(r => setTimeout(r, 10))
        return () => h('h1', 'Async component')
      },
    }

    const AsyncWrapper = { render: () => h(AsyncComp) }
    const AsyncWrapperWrapper = { render: () => h(AsyncWrapper) }

    const SiblingComp = {
      setup() {
        toggle.value = false
        return () => h('span')
      },
    }

    const App = {
      setup() {
        return () =>
          h(
            Suspense,
            {},
            {
              default: () => [
                h('main', {}, [
                  h(AsyncWrapperWrapper, {
                    prop: toggle.value ? 'hello' : 'world',
                  }),
                  h(SiblingComp),
                ]),
              ],
            },
          )
      },
    }

    // server render
    const html = await renderToString(h(App))

    expect(html).toMatchInlineSnapshot(
      `"<main><h1 prop="hello">Async component</h1><span></span></main>"`,
    )

    expect(toggle.value).toBe(false)

    // hydration

    // reset the value
    toggle.value = true
    expect(toggle.value).toBe(true)

    const container = document.createElement('div')
    container.innerHTML = html
    createSSRApp(App).mount(container)

    await new Promise(r => setTimeout(r, 10))

    expect(toggle.value).toBe(false)

    // should be hydrated now
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<main><h1 prop="world">Async component</h1><span></span></main>"`,
    )
  })

  // #3787
  test('unmount async wrapper before load', async () => {
    let resolve: any
    const AsyncComp = defineAsyncComponent(
      () =>
        new Promise(r => {
          resolve = r
        }),
    )

    const show = ref(true)
    const root = document.createElement('div')
    root.innerHTML = '<div><div>async</div></div>'

    createSSRApp({
      render() {
        return h('div', [show.value ? h(AsyncComp) : h('div', 'hi')])
      },
    }).mount(root)

    show.value = false
    await nextTick()
    expect(root.innerHTML).toBe('<div><div>hi</div></div>')
    resolve({})
  })

  test('unmount async wrapper before load (fragment)', async () => {
    let resolve: any
    const AsyncComp = defineAsyncComponent(
      () =>
        new Promise(r => {
          resolve = r
        }),
    )

    const show = ref(true)
    const root = document.createElement('div')
    root.innerHTML = '<div><!--[-->async<!--]--></div>'

    createSSRApp({
      render() {
        return h('div', [show.value ? h(AsyncComp) : h('div', 'hi')])
      },
    }).mount(root)

    show.value = false
    await nextTick()
    expect(root.innerHTML).toBe('<div><div>hi</div></div>')
    resolve({})
  })

  test('elements with camel-case in svg ', () => {
    const { vnode, container } = mountWithHydration(
      '<animateTransform></animateTransform>',
      () => h('animateTransform'),
    )
    expect(vnode.el).toBe(container.firstChild)
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
  })

  test('SVG as a mount container', () => {
    const svgContainer = document.createElement('svg')
    svgContainer.innerHTML = '<g></g>'
    const app = createSSRApp({
      render: () => h('g'),
    })

    expect(
      (
        app.mount(svgContainer).$.subTree as VNode<Node, Element> & {
          el: Element
        }
      ).el instanceof SVGElement,
    )
  })

  test('force hydrate prop with `.prop` modifier', () => {
    const { container } = mountWithHydration('<input type="checkbox">', () =>
      h('input', {
        type: 'checkbox',
        '.indeterminate': true,
      }),
    )
    expect((container.firstChild! as any).indeterminate).toBe(true)
  })

  test('force hydrate input v-model with non-string value bindings', () => {
    const { container } = mountWithHydration(
      '<input type="checkbox" value="true">',
      () =>
        withDirectives(
          createVNode(
            'input',
            { type: 'checkbox', 'true-value': true },
            null,
            PatchFlags.PROPS,
            ['true-value'],
          ),
          [[vModelCheckbox, true]],
        ),
    )
    expect((container.firstChild as any)._trueValue).toBe(true)
  })

  test('force hydrate checkbox with indeterminate', () => {
    const { container } = mountWithHydration(
      '<input type="checkbox" indeterminate>',
      () =>
        createVNode(
          'input',
          { type: 'checkbox', indeterminate: '' },
          null,
          PatchFlags.HOISTED,
        ),
    )
    expect((container.firstChild as any).indeterminate).toBe(true)
  })

  test('force hydrate select option with non-string value bindings', () => {
    const { container } = mountWithHydration(
      '<select><option value="true">ok</option></select>',
      () =>
        h('select', [
          // hoisted because bound value is a constant...
          createVNode('option', { value: true }, null, -1 /* HOISTED */),
        ]),
    )
    expect((container.firstChild!.firstChild as any)._value).toBe(true)
  })

  // #5728
  test('empty text node in slot', () => {
    const Comp = {
      render(this: any) {
        return renderSlot(this.$slots, 'default', {}, () => [
          createTextVNode(''),
        ])
      },
    }
    const { container, vnode } = mountWithHydration('<!--[--><!--]-->', () =>
      h(Comp),
    )
    expect(container.childNodes.length).toBe(3)
    const text = container.childNodes[1]
    expect(text.nodeType).toBe(3)
    expect(vnode.el).toBe(container.childNodes[0])
    // component => slot fragment => text node
    expect((vnode as any).component?.subTree.children[0].el).toBe(text)
  })

  // #7215
  test('empty text node', () => {
    const Comp = {
      render(this: any) {
        return h('p', [''])
      },
    }
    const { container } = mountWithHydration('<p></p>', () => h(Comp))
    expect(container.childNodes.length).toBe(1)
    const p = container.childNodes[0]
    expect(p.childNodes.length).toBe(1)
    const text = p.childNodes[0]
    expect(text.nodeType).toBe(3)
  })

  test('app.unmount()', async () => {
    const container = document.createElement('DIV')
    container.innerHTML = '<button></button>'
    const App = defineComponent({
      setup(_, { expose }) {
        const count = ref(0)

        expose({ count })

        return () =>
          h('button', {
            onClick: () => count.value++,
          })
      },
    })

    const app = createSSRApp(App)
    const vm = app.mount(container)
    await nextTick()
    expect((container as any)._vnode).toBeDefined()
    // @ts-expect-error - expose()'d properties are not available on vm type
    expect(vm.count).toBe(0)

    app.unmount()
    expect((container as any)._vnode).toBe(null)
  })

  // #6637
  test('stringified root fragment', () => {
    mountWithHydration(`<!--[--><div></div><!--]-->`, () =>
      createStaticVNode(`<div></div>`, 1),
    )
    expect(`mismatch`).not.toHaveBeenWarned()
  })

  test('transition appear', () => {
    const { vnode, container } = mountWithHydration(
      `<template><div>foo</div></template>`,
      () =>
        h(
          Transition,
          { appear: true },
          {
            default: () => h('div', 'foo'),
          },
        ),
    )
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div
        class="v-enter-from v-enter-active"
      >
        foo
      </div>
    `)
    expect(vnode.el).toBe(container.firstChild)
    expect(`mismatch`).not.toHaveBeenWarned()
  })

  test('transition appear with v-if', () => {
    const show = false
    const { vnode, container } = mountWithHydration(
      `<template><!----></template>`,
      () =>
        h(
          Transition,
          { appear: true },
          {
            default: () => (show ? h('div', 'foo') : createCommentVNode('')),
          },
        ),
    )
    expect(container.firstChild).toMatchInlineSnapshot('<!---->')
    expect(vnode.el).toBe(container.firstChild)
    expect(`mismatch`).not.toHaveBeenWarned()
  })

  test('transition appear with v-show', () => {
    const show = false
    const { vnode, container } = mountWithHydration(
      `<template><div style="display: none;">foo</div></template>`,
      () =>
        h(
          Transition,
          { appear: true },
          {
            default: () =>
              withDirectives(createVNode('div', null, 'foo'), [[vShow, show]]),
          },
        ),
    )
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div
        class="v-enter-from v-enter-active"
        style="display: none;"
      >
        foo
      </div>
    `)
    expect((container.firstChild as any)[vShowOriginalDisplay]).toBe('')
    expect(vnode.el).toBe(container.firstChild)
    expect(`mismatch`).not.toHaveBeenWarned()
  })

  test('transition appear w/ event listener', async () => {
    const container = document.createElement('div')
    container.innerHTML = `<template><button>0</button></template>`
    createSSRApp({
      data() {
        return {
          count: 0,
        }
      },
      template: `
        <Transition appear>
          <button @click="count++">{{count}}</button>
        </Transition>
      `,
    }).mount(container)

    expect(container.firstChild).toMatchInlineSnapshot(`
      <button
        class="v-enter-from v-enter-active"
      >
        0
      </button>
    `)

    triggerEvent('click', container.querySelector('button')!)
    await nextTick()
    expect(container.firstChild).toMatchInlineSnapshot(`
      <button
        class="v-enter-from v-enter-active"
      >
        1
      </button>
    `)
  })

  // #10607
  test('update component stable slot (prod + optimized mode)', async () => {
    __DEV__ = false
    const container = document.createElement('div')
    container.innerHTML = `<template><div show="false"><!--[--><div><div><!----></div></div><div>0</div><!--]--></div></template>`
    const Comp = {
      render(this: any) {
        return (
          openBlock(),
          createElementBlock('div', null, [renderSlot(this.$slots, 'default')])
        )
      },
    }
    const show = ref(false)
    const clicked = ref(false)

    const Wrapper = {
      setup() {
        const items = ref<number[]>([])
        onMounted(() => {
          items.value = [1]
        })
        return () => {
          return (
            openBlock(),
            createBlock(Comp, null, {
              default: withCtx(() => [
                createElementVNode('div', null, [
                  createElementVNode('div', null, [
                    clicked.value
                      ? (openBlock(),
                        createElementBlock('div', { key: 0 }, 'foo'))
                      : createCommentVNode('v-if', true),
                  ]),
                ]),
                createElementVNode(
                  'div',
                  null,
                  items.value.length,
                  1 /* TEXT */,
                ),
              ]),
              _: 1 /* STABLE */,
            })
          )
        }
      },
    }
    createSSRApp({
      components: { Wrapper },
      data() {
        return { show }
      },
      template: `<Wrapper :show="show"/>`,
    }).mount(container)

    await nextTick()
    expect(container.innerHTML).toBe(
      `<div show="false"><!--[--><div><div><!----></div></div><div>1</div><!--]--></div>`,
    )

    show.value = true
    await nextTick()
    expect(async () => {
      clicked.value = true
      await nextTick()
    }).not.toThrow("Cannot read properties of null (reading 'insertBefore')")

    await nextTick()
    expect(container.innerHTML).toBe(
      `<div show="true"><!--[--><div><div><div>foo</div></div></div><div>1</div><!--]--></div>`,
    )
    __DEV__ = true
  })

  describe('mismatch handling', () => {
    test('text node', () => {
      const { container } = mountWithHydration(`foo`, () => 'bar')
      expect(container.textContent).toBe('bar')
      expect(`Hydration text mismatch`).toHaveBeenWarned()
    })

    test('element text content', () => {
      const { container } = mountWithHydration(`<div>foo</div>`, () =>
        h('div', 'bar'),
      )
      expect(container.innerHTML).toBe('<div>bar</div>')
      expect(`Hydration text content mismatch`).toHaveBeenWarned()
    })

    test('not enough children', () => {
      const { container } = mountWithHydration(`<div></div>`, () =>
        h('div', [h('span', 'foo'), h('span', 'bar')]),
      )
      expect(container.innerHTML).toBe(
        '<div><span>foo</span><span>bar</span></div>',
      )
      expect(`Hydration children mismatch`).toHaveBeenWarned()
    })

    test('too many children', () => {
      const { container } = mountWithHydration(
        `<div><span>foo</span><span>bar</span></div>`,
        () => h('div', [h('span', 'foo')]),
      )
      expect(container.innerHTML).toBe('<div><span>foo</span></div>')
      expect(`Hydration children mismatch`).toHaveBeenWarned()
    })

    test('complete mismatch', () => {
      const { container } = mountWithHydration(
        `<div><span>foo</span><span>bar</span></div>`,
        () => h('div', [h('div', 'foo'), h('p', 'bar')]),
      )
      expect(container.innerHTML).toBe('<div><div>foo</div><p>bar</p></div>')
      expect(`Hydration node mismatch`).toHaveBeenWarnedTimes(2)
    })

    test('fragment mismatch removal', () => {
      const { container } = mountWithHydration(
        `<div><!--[--><div>foo</div><div>bar</div><!--]--></div>`,
        () => h('div', [h('span', 'replaced')]),
      )
      expect(container.innerHTML).toBe('<div><span>replaced</span></div>')
      expect(`Hydration node mismatch`).toHaveBeenWarned()
    })

    test('fragment not enough children', () => {
      const { container } = mountWithHydration(
        `<div><!--[--><div>foo</div><!--]--><div>baz</div></div>`,
        () => h('div', [[h('div', 'foo'), h('div', 'bar')], h('div', 'baz')]),
      )
      expect(container.innerHTML).toBe(
        '<div><!--[--><div>foo</div><div>bar</div><!--]--><div>baz</div></div>',
      )
      expect(`Hydration node mismatch`).toHaveBeenWarned()
    })

    test('fragment too many children', () => {
      const { container } = mountWithHydration(
        `<div><!--[--><div>foo</div><div>bar</div><!--]--><div>baz</div></div>`,
        () => h('div', [[h('div', 'foo')], h('div', 'baz')]),
      )
      expect(container.innerHTML).toBe(
        '<div><!--[--><div>foo</div><!--]--><div>baz</div></div>',
      )
      // fragment ends early and attempts to hydrate the extra <div>bar</div>
      // as 2nd fragment child.
      expect(`Hydration text content mismatch`).toHaveBeenWarned()
      // excessive children removal
      expect(`Hydration children mismatch`).toHaveBeenWarned()
    })

    test('Teleport target has empty children', () => {
      const teleportContainer = document.createElement('div')
      teleportContainer.id = 'teleport'
      document.body.appendChild(teleportContainer)

      mountWithHydration('<!--teleport start--><!--teleport end-->', () =>
        h(Teleport, { to: '#teleport' }, [h('span', 'value')]),
      )
      expect(teleportContainer.innerHTML).toBe(`<span>value</span>`)
      expect(`Hydration children mismatch`).toHaveBeenWarned()
    })

    test('comment mismatch (element)', () => {
      const { container } = mountWithHydration(`<div><span></span></div>`, () =>
        h('div', [createCommentVNode('hi')]),
      )
      expect(container.innerHTML).toBe('<div><!--hi--></div>')
      expect(`Hydration node mismatch`).toHaveBeenWarned()
    })

    test('comment mismatch (text)', () => {
      const { container } = mountWithHydration(`<div>foobar</div>`, () =>
        h('div', [createCommentVNode('hi')]),
      )
      expect(container.innerHTML).toBe('<div><!--hi--></div>')
      expect(`Hydration node mismatch`).toHaveBeenWarned()
    })

    test('class mismatch', () => {
      mountWithHydration(`<div class="foo bar"></div>`, () =>
        h('div', { class: ['foo', 'bar'] }),
      )
      mountWithHydration(`<div class="foo bar"></div>`, () =>
        h('div', { class: { foo: true, bar: true } }),
      )
      mountWithHydration(`<div class="foo bar"></div>`, () =>
        h('div', { class: 'foo bar' }),
      )
      // SVG classes
      mountWithHydration(`<svg class="foo bar"></svg>`, () =>
        h('svg', { class: 'foo bar' }),
      )
      // class with different order
      mountWithHydration(`<div class="foo bar"></div>`, () =>
        h('div', { class: 'bar foo' }),
      )
      expect(`Hydration class mismatch`).not.toHaveBeenWarned()
      mountWithHydration(`<div class="foo bar"></div>`, () =>
        h('div', { class: 'foo' }),
      )
      expect(`Hydration class mismatch`).toHaveBeenWarned()
    })

    test('style mismatch', () => {
      mountWithHydration(`<div style="color:red;"></div>`, () =>
        h('div', { style: { color: 'red' } }),
      )
      mountWithHydration(`<div style="color:red;"></div>`, () =>
        h('div', { style: `color:red;` }),
      )
      mountWithHydration(
        `<div style="color:red; font-size: 12px;"></div>`,
        () => h('div', { style: `font-size: 12px; color:red;` }),
      )
      mountWithHydration(`<div style="color:red;display:none;"></div>`, () =>
        withDirectives(createVNode('div', { style: 'color: red' }, ''), [
          [vShow, false],
        ]),
      )
      expect(`Hydration style mismatch`).not.toHaveBeenWarned()
      mountWithHydration(`<div style="color:red;"></div>`, () =>
        h('div', { style: { color: 'green' } }),
      )
      expect(`Hydration style mismatch`).toHaveBeenWarnedTimes(1)
    })

    test('style mismatch when no style attribute is present', () => {
      mountWithHydration(`<div></div>`, () =>
        h('div', { style: { color: 'red' } }),
      )
      expect(`Hydration style mismatch`).toHaveBeenWarnedTimes(1)
    })

    test('style mismatch w/ v-show', () => {
      mountWithHydration(`<div style="color:red;display:none"></div>`, () =>
        withDirectives(createVNode('div', { style: 'color: red' }, ''), [
          [vShow, false],
        ]),
      )
      expect(`Hydration style mismatch`).not.toHaveBeenWarned()
      mountWithHydration(`<div style="color:red;"></div>`, () =>
        withDirectives(createVNode('div', { style: 'color: red' }, ''), [
          [vShow, false],
        ]),
      )
      expect(`Hydration style mismatch`).toHaveBeenWarnedTimes(1)
    })

    test('attr mismatch', () => {
      mountWithHydration(`<div id="foo"></div>`, () => h('div', { id: 'foo' }))
      mountWithHydration(`<div spellcheck></div>`, () =>
        h('div', { spellcheck: '' }),
      )
      mountWithHydration(`<div></div>`, () => h('div', { id: undefined }))
      // boolean
      mountWithHydration(`<select multiple></div>`, () =>
        h('select', { multiple: true }),
      )
      mountWithHydration(`<select multiple></div>`, () =>
        h('select', { multiple: 'multiple' }),
      )
      expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()

      mountWithHydration(`<div></div>`, () => h('div', { id: 'foo' }))
      expect(`Hydration attribute mismatch`).toHaveBeenWarnedTimes(1)

      mountWithHydration(`<div id="bar"></div>`, () => h('div', { id: 'foo' }))
      expect(`Hydration attribute mismatch`).toHaveBeenWarnedTimes(2)
    })

    test('attr special case: textarea value', () => {
      mountWithHydration(`<textarea>foo</textarea>`, () =>
        h('textarea', { value: 'foo' }),
      )
      mountWithHydration(`<textarea></textarea>`, () =>
        h('textarea', { value: '' }),
      )
      expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()

      mountWithHydration(`<textarea>foo</textarea>`, () =>
        h('textarea', { value: 'bar' }),
      )
      expect(`Hydration attribute mismatch`).toHaveBeenWarned()
    })

    test('boolean attr handling', () => {
      mountWithHydration(`<input />`, () => h('input', { readonly: false }))
      expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()

      mountWithHydration(`<input readonly />`, () =>
        h('input', { readonly: true }),
      )
      expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()

      mountWithHydration(`<input readonly="readonly" />`, () =>
        h('input', { readonly: true }),
      )
      expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()
    })

    test('client value is null or undefined', () => {
      mountWithHydration(`<div></div>`, () =>
        h('div', { draggable: undefined }),
      )
      expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()

      mountWithHydration(`<input />`, () => h('input', { type: null }))
      expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()
    })

    test('should not warn against object values', () => {
      mountWithHydration(`<input />`, () => h('input', { from: {} }))
      expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()
    })

    test('should not warn on falsy bindings of non-property keys', () => {
      mountWithHydration(`<button />`, () => h('button', { href: undefined }))
      expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()
    })

    test('should not warn on non-renderable option values', () => {
      mountWithHydration(`<select><option>hello</option></select>`, () =>
        h('select', [h('option', { value: ['foo'] }, 'hello')]),
      )
      expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()
    })

    test('should not warn css v-bind', () => {
      const container = document.createElement('div')
      container.innerHTML = `<div style="--foo:red;color:var(--foo);" />`
      const app = createSSRApp({
        setup() {
          useCssVars(() => ({
            foo: 'red',
          }))
          return () => h('div', { style: { color: 'var(--foo)' } })
        },
      })
      app.mount(container)
      expect(`Hydration style mismatch`).not.toHaveBeenWarned()
    })

    // #10317 - test case from #10325
    test('css vars should only be added to expected on component root dom', () => {
      const container = document.createElement('div')
      container.innerHTML = `<div style="--foo:red;"><div style="color:var(--foo);" /></div>`
      const app = createSSRApp({
        setup() {
          useCssVars(() => ({
            foo: 'red',
          }))
          return () =>
            h('div', null, [h('div', { style: { color: 'var(--foo)' } })])
        },
      })
      app.mount(container)
      expect(`Hydration style mismatch`).not.toHaveBeenWarned()
    })

    // #11188
    test('css vars support fallthrough', () => {
      const container = document.createElement('div')
      container.innerHTML = `<div style="padding: 4px;--foo:red;"></div>`
      const app = createSSRApp({
        setup() {
          useCssVars(() => ({
            foo: 'red',
          }))
          return () => h(Child)
        },
      })
      const Child = {
        setup() {
          return () => h('div', { style: 'padding: 4px' })
        },
      }
      app.mount(container)
      expect(`Hydration style mismatch`).not.toHaveBeenWarned()
    })

    // #11189
    test('should not warn for directives that mutate DOM in created', () => {
      const container = document.createElement('div')
      container.innerHTML = `<div class="test red"></div>`
      const vColor: ObjectDirective = {
        created(el, binding) {
          el.classList.add(binding.value)
        },
      }
      const app = createSSRApp({
        setup() {
          return () =>
            withDirectives(h('div', { class: 'test' }), [[vColor, 'red']])
        },
      })
      app.mount(container)
      expect(`Hydration style mismatch`).not.toHaveBeenWarned()
    })
  })
})
