import { createVaporSSRApp, delegateEvents } from '../src'
import { nextTick, ref } from '@vue/runtime-dom'
import { compileScript, parse } from '@vue/compiler-sfc'
import * as runtimeVapor from '../src'
import * as runtimeDom from '@vue/runtime-dom'
import * as VueServerRenderer from '@vue/server-renderer'

const Vue = { ...runtimeDom, ...runtimeVapor }

function compile(
  sfc: string,
  data: runtimeDom.Ref<any>,
  components: Record<string, any> = {},
  ssr = false,
) {
  if (!sfc.includes(`<script`)) {
    sfc =
      `<script vapor>const data = _data; const components = _components;</script>` +
      sfc
  }
  const descriptor = parse(sfc).descriptor

  const script = compileScript(descriptor, {
    id: 'x',
    isProd: true,
    inlineTemplate: true,
    genDefaultAs: '__sfc__',
    vapor: true,
    templateOptions: {
      ssr,
    },
  })

  const code =
    script.content
      .replace(/\bimport {/g, 'const {')
      .replace(/ as _/g, ': _')
      .replace(/} from ['"]vue['"]/g, `} = Vue`)
      .replace(/} from "vue\/server-renderer"/g, '} = VueServerRenderer') +
    '\nreturn __sfc__'

  return new Function('Vue', 'VueServerRenderer', '_data', '_components', code)(
    Vue,
    VueServerRenderer,
    data,
    components,
  )
}

async function testHydration(
  code: string,
  components: Record<string, string> = {},
) {
  const data = ref('foo')
  const ssrComponents: any = {}
  const clientComponents: any = {}
  for (const key in components) {
    clientComponents[key] = compile(components[key], data, clientComponents)
    ssrComponents[key] = compile(components[key], data, ssrComponents, true)
  }

  const serverComp = compile(code, data, ssrComponents, true)
  const html = await VueServerRenderer.renderToString(
    runtimeDom.createSSRApp(serverComp),
  )
  const container = document.createElement('div')
  document.body.appendChild(container)
  container.innerHTML = html

  const clientComp = compile(code, data, clientComponents)
  const app = createVaporSSRApp(clientComp)
  app.mount(container)
  return { data, container }
}

const triggerEvent = (type: string, el: Element) => {
  const event = new Event(type, { bubbles: true })
  el.dispatchEvent(event)
}

describe('Vapor Mode hydration', () => {
  delegateEvents('click')

  beforeEach(() => {
    document.body.innerHTML = ''
  })

  test('root text', async () => {
    const { data, container } = await testHydration(`
      <template>{{ data }}</template>
    `)
    expect(container.innerHTML).toMatchInlineSnapshot(`"foo"`)

    data.value = 'bar'
    await nextTick()
    expect(container.innerHTML).toMatchInlineSnapshot(`"bar"`)
  })

  test('root comment', async () => {
    const { container } = await testHydration(`
      <template><!----></template>
    `)
    expect(container.innerHTML).toBe('<!---->')
    expect(`Hydration children mismatch in <div>`).not.toHaveBeenWarned()
  })

  test('root with mixed element and text', async () => {
    const { container, data } = await testHydration(`
      <template> A<span>{{ data }}</span>{{ data }}</template>
    `)
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<!--[--> A<span>foo</span>foo<!--]-->"`,
    )

    data.value = 'bar'
    await nextTick()
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<!--[--> A<span>bar</span>bar<!--]-->"`,
    )
  })

  test('empty element', async () => {
    const { container } = await testHydration(`
      <template><div/></template>
    `)
    expect(container.innerHTML).toBe('<div></div>')
    expect(`Hydration children mismatch in <div>`).not.toHaveBeenWarned()
  })

  test('element with binding and text children', async () => {
    const { container, data } = await testHydration(`
      <template><div :class="data">{{ data }}</div></template>
    `)
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<div class="foo">foo</div>"`,
    )

    data.value = 'bar'
    await nextTick()
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<div class="bar">bar</div>"`,
    )
  })

  test('element with elements children', async () => {
    const { container } = await testHydration(`
      <template>
        <div>
          <span>{{ data }}</span>
          <span :class="data" @click="data = 'bar'"/>
        </div>
      </template>
    `)
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<div><span>foo</span><span class="foo"></span></div>"`,
    )

    // event handler
    triggerEvent('click', container.querySelector('.foo')!)

    await nextTick()
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<div><span>bar</span><span class="bar"></span></div>"`,
    )
  })

  test('basic component', async () => {
    const { container, data } = await testHydration(
      `
      <template><div><span></span><components.Child/></div></template>
      `,
      { Child: `<template>{{ data }}</template>` },
    )
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<div><span></span>foo</div>"`,
    )

    data.value = 'bar'
    await nextTick()
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<div><span></span>bar</div>"`,
    )
  })

  test('fragment component', async () => {
    const { container, data } = await testHydration(
      `
      <template><div><span></span><components.Child/></div></template>
      `,
      { Child: `<template><div>{{ data }}</div>-{{ data }}-</template>` },
    )
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<div><span></span><!--[--><div>foo</div>-foo-<!--]--></div>"`,
    )

    data.value = 'bar'
    await nextTick()
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<div><span></span><!--[--><div>bar</div>-bar-<!--]--></div>"`,
    )
  })

  test('fragment component with prepend', async () => {
    const { container, data } = await testHydration(
      `
      <template><div><components.Child/><span></span></div></template>
      `,
      { Child: `<template><div>{{ data }}</div>-{{ data }}-</template>` },
    )
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<div><!--[--><div>foo</div>-foo-<!--]--><span></span></div>"`,
    )

    data.value = 'bar'
    await nextTick()
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<div><!--[--><div>bar</div>-bar-<!--]--><span></span></div>"`,
    )
  })

  test('nested fragment components', async () => {
    const { container, data } = await testHydration(
      `
      <template><div><components.Parent/><span></span></div></template>
      `,
      {
        Parent: `<template><div/><components.Child/><div/></template>`,
        Child: `<template><div>{{ data }}</div>-{{ data }}-</template>`,
      },
    )
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<div><!--[--><div></div><!--[--><div>foo</div>-foo-<!--]--><div></div><!--]--><span></span></div>"`,
    )

    data.value = 'bar'
    await nextTick()
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<div><!--[--><div></div><!--[--><div>bar</div>-bar-<!--]--><div></div><!--]--><span></span></div>"`,
    )
  })

  test.todo('if')

  test.todo('for')

  test.todo('slots')

  // test('element with ref', () => {
  //   const el = ref()
  //   const { vnode, container } = mountWithHydration('<div></div>', () =>
  //     h('div', { ref: el }),
  //   )
  //   expect(vnode.el).toBe(container.firstChild)
  //   expect(el.value).toBe(vnode.el)
  // })

  // test('with data-allow-mismatch component when using onServerPrefetch', async () => {
  //   const Comp = {
  //     template: `
  //       <div>Comp2</div>
  //     `,
  //   }
  //   let foo: any
  //   const App = {
  //     setup() {
  //       const flag = ref(true)
  //       foo = () => {
  //         flag.value = false
  //       }
  //       onServerPrefetch(() => (flag.value = false))
  //       return { flag }
  //     },
  //     components: {
  //       Comp,
  //     },
  //     template: `
  //       <span data-allow-mismatch>
  //         <Comp v-if="flag"></Comp>
  //       </span>
  //     `,
  //   }
  //   // hydrate
  //   const container = document.createElement('div')
  //   container.innerHTML = await renderToString(h(App))
  //   createSSRApp(App).mount(container)
  //   expect(container.innerHTML).toBe(
  //     '<span data-allow-mismatch=""><div>Comp2</div></span>',
  //   )
  //   foo()
  //   await nextTick()
  //   expect(container.innerHTML).toBe(
  //     '<span data-allow-mismatch=""><!--v-if--></span>',
  //   )
  // })

  // // compile SSR + client render fn from the same template & hydrate
  // test('full compiler integration', async () => {
  //   const mounted: string[] = []
  //   const log = vi.fn()
  //   const toggle = ref(true)

  //   const Child = {
  //     data() {
  //       return {
  //         count: 0,
  //         text: 'hello',
  //         style: {
  //           color: 'red',
  //         },
  //       }
  //     },
  //     mounted() {
  //       mounted.push('child')
  //     },
  //     template: `
  //     <div>
  //       <span class="count" :style="style">{{ count }}</span>
  //       <button class="inc" @click="count++">inc</button>
  //       <button class="change" @click="style.color = 'green'" >change color</button>
  //       <button class="emit" @click="$emit('foo')">emit</button>
  //       <span class="text">{{ text }}</span>
  //       <input v-model="text">
  //     </div>
  //     `,
  //   }

  //   const App = {
  //     setup() {
  //       return { toggle }
  //     },
  //     mounted() {
  //       mounted.push('parent')
  //     },
  //     template: `
  //       <div>
  //         <span>hello</span>
  //         <template v-if="toggle">
  //           <Child @foo="log('child')"/>
  //           <template v-if="true">
  //             <button class="parent-click" @click="log('click')">click me</button>
  //           </template>
  //         </template>
  //         <span>hello</span>
  //       </div>`,
  //     components: {
  //       Child,
  //     },
  //     methods: {
  //       log,
  //     },
  //   }

  //   const container = document.createElement('div')
  //   // server render
  //   container.innerHTML = await renderToString(h(App))
  //   // hydrate
  //   createSSRApp(App).mount(container)

  //   // assert interactions
  //   // 1. parent button click
  //   triggerEvent('click', container.querySelector('.parent-click')!)
  //   expect(log).toHaveBeenCalledWith('click')

  //   // 2. child inc click + text interpolation
  //   const count = container.querySelector('.count') as HTMLElement
  //   expect(count.textContent).toBe(`0`)
  //   triggerEvent('click', container.querySelector('.inc')!)
  //   await nextTick()
  //   expect(count.textContent).toBe(`1`)

  //   // 3. child color click + style binding
  //   expect(count.style.color).toBe('red')
  //   triggerEvent('click', container.querySelector('.change')!)
  //   await nextTick()
  //   expect(count.style.color).toBe('green')

  //   // 4. child event emit
  //   triggerEvent('click', container.querySelector('.emit')!)
  //   expect(log).toHaveBeenCalledWith('child')

  //   // 5. child v-model
  //   const text = container.querySelector('.text')!
  //   const input = container.querySelector('input')!
  //   expect(text.textContent).toBe('hello')
  //   input.value = 'bye'
  //   triggerEvent('input', input)
  //   await nextTick()
  //   expect(text.textContent).toBe('bye')
  // })

  // test('handle click error in ssr mode', async () => {
  //   const App = {
  //     setup() {
  //       const throwError = () => {
  //         throw new Error('Sentry Error')
  //       }
  //       return { throwError }
  //     },
  //     template: `
  //       <div>
  //         <button class="parent-click" @click="throwError">click me</button>
  //       </div>`,
  //   }

  //   const container = document.createElement('div')
  //   // server render
  //   container.innerHTML = await renderToString(h(App))
  //   // hydrate
  //   const app = createSSRApp(App)
  //   const handler = (app.config.errorHandler = vi.fn())
  //   app.mount(container)
  //   // assert interactions
  //   // parent button click
  //   triggerEvent('click', container.querySelector('.parent-click')!)
  //   expect(handler).toHaveBeenCalled()
  // })

  // test('handle blur error in ssr mode', async () => {
  //   const App = {
  //     setup() {
  //       const throwError = () => {
  //         throw new Error('Sentry Error')
  //       }
  //       return { throwError }
  //     },
  //     template: `
  //       <div>
  //         <input class="parent-click" @blur="throwError"/>
  //       </div>`,
  //   }

  //   const container = document.createElement('div')
  //   // server render
  //   container.innerHTML = await renderToString(h(App))
  //   // hydrate
  //   const app = createSSRApp(App)
  //   const handler = (app.config.errorHandler = vi.fn())
  //   app.mount(container)
  //   // assert interactions
  //   // parent blur event
  //   triggerEvent('blur', container.querySelector('.parent-click')!)
  //   expect(handler).toHaveBeenCalled()
  // })

  // test('async component', async () => {
  //   const spy = vi.fn()
  //   const Comp = () =>
  //     h(
  //       'button',
  //       {
  //         onClick: spy,
  //       },
  //       'hello!',
  //     )

  //   let serverResolve: any
  //   let AsyncComp = defineAsyncComponent(
  //     () =>
  //       new Promise(r => {
  //         serverResolve = r
  //       }),
  //   )

  //   const App = {
  //     render() {
  //       return ['hello', h(AsyncComp), 'world']
  //     },
  //   }

  //   // server render
  //   const htmlPromise = renderToString(h(App))
  //   serverResolve(Comp)
  //   const html = await htmlPromise
  //   expect(html).toMatchInlineSnapshot(
  //     `"<!--[-->hello<button>hello!</button>world<!--]-->"`,
  //   )

  //   // hydration
  //   let clientResolve: any
  //   AsyncComp = defineAsyncComponent(
  //     () =>
  //       new Promise(r => {
  //         clientResolve = r
  //       }),
  //   )

  //   const container = document.createElement('div')
  //   container.innerHTML = html
  //   createSSRApp(App).mount(container)

  //   // hydration not complete yet
  //   triggerEvent('click', container.querySelector('button')!)
  //   expect(spy).not.toHaveBeenCalled()

  //   // resolve
  //   clientResolve(Comp)
  //   await new Promise(r => setTimeout(r))

  //   // should be hydrated now
  //   triggerEvent('click', container.querySelector('button')!)
  //   expect(spy).toHaveBeenCalled()
  // })

  // test('update async wrapper before resolve', async () => {
  //   const Comp = {
  //     render() {
  //       return h('h1', 'Async component')
  //     },
  //   }
  //   let serverResolve: any
  //   let AsyncComp = defineAsyncComponent(
  //     () =>
  //       new Promise(r => {
  //         serverResolve = r
  //       }),
  //   )

  //   const toggle = ref(true)
  //   const App = {
  //     setup() {
  //       onMounted(() => {
  //         // change state, this makes updateComponent(AsyncComp) execute before
  //         // the async component is resolved
  //         toggle.value = false
  //       })

  //       return () => {
  //         return [toggle.value ? 'hello' : 'world', h(AsyncComp)]
  //       }
  //     },
  //   }

  //   // server render
  //   const htmlPromise = renderToString(h(App))
  //   serverResolve(Comp)
  //   const html = await htmlPromise
  //   expect(html).toMatchInlineSnapshot(
  //     `"<!--[-->hello<h1>Async component</h1><!--]-->"`,
  //   )

  //   // hydration
  //   let clientResolve: any
  //   AsyncComp = defineAsyncComponent(
  //     () =>
  //       new Promise(r => {
  //         clientResolve = r
  //       }),
  //   )

  //   const container = document.createElement('div')
  //   container.innerHTML = html
  //   createSSRApp(App).mount(container)

  //   // resolve
  //   clientResolve(Comp)
  //   await new Promise(r => setTimeout(r))

  //   // should be hydrated now
  //   expect(`Hydration node mismatch`).not.toHaveBeenWarned()
  //   expect(container.innerHTML).toMatchInlineSnapshot(
  //     `"<!--[-->world<h1>Async component</h1><!--]-->"`,
  //   )
  // })

  // test('hydrate safely when property used by async setup changed before render', async () => {
  //   const toggle = ref(true)

  //   const AsyncComp = {
  //     async setup() {
  //       await new Promise<void>(r => setTimeout(r, 10))
  //       return () => h('h1', 'Async component')
  //     },
  //   }

  //   const AsyncWrapper = {
  //     render() {
  //       return h(AsyncComp)
  //     },
  //   }

  //   const SiblingComp = {
  //     setup() {
  //       toggle.value = false
  //       return () => h('span')
  //     },
  //   }

  //   const App = {
  //     setup() {
  //       return () =>
  //         h(
  //           Suspense,
  //           {},
  //           {
  //             default: () => [
  //               h('main', {}, [
  //                 h(AsyncWrapper, {
  //                   prop: toggle.value ? 'hello' : 'world',
  //                 }),
  //                 h(SiblingComp),
  //               ]),
  //             ],
  //           },
  //         )
  //     },
  //   }

  //   // server render
  //   const html = await renderToString(h(App))

  //   expect(html).toMatchInlineSnapshot(
  //     `"<main><h1 prop="hello">Async component</h1><span></span></main>"`,
  //   )

  //   expect(toggle.value).toBe(false)

  //   // hydration

  //   // reset the value
  //   toggle.value = true
  //   expect(toggle.value).toBe(true)

  //   const container = document.createElement('div')
  //   container.innerHTML = html
  //   createSSRApp(App).mount(container)

  //   await new Promise(r => setTimeout(r, 10))

  //   expect(toggle.value).toBe(false)

  //   // should be hydrated now
  //   expect(container.innerHTML).toMatchInlineSnapshot(
  //     `"<main><h1 prop="world">Async component</h1><span></span></main>"`,
  //   )
  // })

  // test('hydrate safely when property used by deep nested async setup changed before render', async () => {
  //   const toggle = ref(true)

  //   const AsyncComp = {
  //     async setup() {
  //       await new Promise<void>(r => setTimeout(r, 10))
  //       return () => h('h1', 'Async component')
  //     },
  //   }

  //   const AsyncWrapper = { render: () => h(AsyncComp) }
  //   const AsyncWrapperWrapper = { render: () => h(AsyncWrapper) }

  //   const SiblingComp = {
  //     setup() {
  //       toggle.value = false
  //       return () => h('span')
  //     },
  //   }

  //   const App = {
  //     setup() {
  //       return () =>
  //         h(
  //           Suspense,
  //           {},
  //           {
  //             default: () => [
  //               h('main', {}, [
  //                 h(AsyncWrapperWrapper, {
  //                   prop: toggle.value ? 'hello' : 'world',
  //                 }),
  //                 h(SiblingComp),
  //               ]),
  //             ],
  //           },
  //         )
  //     },
  //   }

  //   // server render
  //   const html = await renderToString(h(App))

  //   expect(html).toMatchInlineSnapshot(
  //     `"<main><h1 prop="hello">Async component</h1><span></span></main>"`,
  //   )

  //   expect(toggle.value).toBe(false)

  //   // hydration

  //   // reset the value
  //   toggle.value = true
  //   expect(toggle.value).toBe(true)

  //   const container = document.createElement('div')
  //   container.innerHTML = html
  //   createSSRApp(App).mount(container)

  //   await new Promise(r => setTimeout(r, 10))

  //   expect(toggle.value).toBe(false)

  //   // should be hydrated now
  //   expect(container.innerHTML).toMatchInlineSnapshot(
  //     `"<main><h1 prop="world">Async component</h1><span></span></main>"`,
  //   )
  // })

  // // #3787
  // test('unmount async wrapper before load', async () => {
  //   let resolve: any
  //   const AsyncComp = defineAsyncComponent(
  //     () =>
  //       new Promise(r => {
  //         resolve = r
  //       }),
  //   )

  //   const show = ref(true)
  //   const root = document.createElement('div')
  //   root.innerHTML = '<div><div>async</div></div>'

  //   createSSRApp({
  //     render() {
  //       return h('div', [show.value ? h(AsyncComp) : h('div', 'hi')])
  //     },
  //   }).mount(root)

  //   show.value = false
  //   await nextTick()
  //   expect(root.innerHTML).toBe('<div><div>hi</div></div>')
  //   resolve({})
  // })

  // //#12362
  // test('nested async wrapper', async () => {
  //   const Toggle = defineAsyncComponent(
  //     () =>
  //       new Promise(r => {
  //         r(
  //           defineComponent({
  //             setup(_, { slots }) {
  //               const show = ref(false)
  //               onMounted(() => {
  //                 nextTick(() => {
  //                   show.value = true
  //                 })
  //               })
  //               return () =>
  //                 withDirectives(
  //                   h('div', null, [renderSlot(slots, 'default')]),
  //                   [[vShow, show.value]],
  //                 )
  //             },
  //           }) as any,
  //         )
  //       }),
  //   )

  //   const Wrapper = defineAsyncComponent(() => {
  //     return new Promise(r => {
  //       r(
  //         defineComponent({
  //           render(this: any) {
  //             return renderSlot(this.$slots, 'default')
  //           },
  //         }) as any,
  //       )
  //     })
  //   })

  //   const count = ref(0)
  //   const fn = vi.fn()
  //   const Child = {
  //     setup() {
  //       onMounted(() => {
  //         fn()
  //         count.value++
  //       })
  //       return () => h('div', count.value)
  //     },
  //   }

  //   const App = {
  //     render() {
  //       return h(Toggle, null, {
  //         default: () =>
  //           h(Wrapper, null, {
  //             default: () =>
  //               h(Wrapper, null, {
  //                 default: () => h(Child),
  //               }),
  //           }),
  //       })
  //     },
  //   }

  //   const root = document.createElement('div')
  //   root.innerHTML = await renderToString(h(App))
  //   expect(root.innerHTML).toMatchInlineSnapshot(
  //     `"<div style="display:none;"><!--[--><!--[--><!--[--><div>0</div><!--]--><!--]--><!--]--></div>"`,
  //   )

  //   createSSRApp(App).mount(root)
  //   await nextTick()
  //   await nextTick()
  //   expect(root.innerHTML).toMatchInlineSnapshot(
  //     `"<div style=""><!--[--><!--[--><!--[--><div>1</div><!--]--><!--]--><!--]--></div>"`,
  //   )
  //   expect(fn).toBeCalledTimes(1)
  // })

  // test('unmount async wrapper before load (fragment)', async () => {
  //   let resolve: any
  //   const AsyncComp = defineAsyncComponent(
  //     () =>
  //       new Promise(r => {
  //         resolve = r
  //       }),
  //   )

  //   const show = ref(true)
  //   const root = document.createElement('div')
  //   root.innerHTML = '<div><!--[-->async<!--]--></div>'

  //   createSSRApp({
  //     render() {
  //       return h('div', [show.value ? h(AsyncComp) : h('div', 'hi')])
  //     },
  //   }).mount(root)

  //   show.value = false
  //   await nextTick()
  //   expect(root.innerHTML).toBe('<div><div>hi</div></div>')
  //   resolve({})
  // })

  // test('elements with camel-case in svg ', () => {
  //   const { vnode, container } = mountWithHydration(
  //     '<animateTransform></animateTransform>',
  //     () => h('animateTransform'),
  //   )
  //   expect(vnode.el).toBe(container.firstChild)
  //   expect(`Hydration node mismatch`).not.toHaveBeenWarned()
  // })

  // test('SVG as a mount container', () => {
  //   const svgContainer = document.createElement('svg')
  //   svgContainer.innerHTML = '<g></g>'
  //   const app = createSSRApp({
  //     render: () => h('g'),
  //   })

  //   expect(
  //     (
  //       app.mount(svgContainer).$.subTree as VNode<Node, Element> & {
  //         el: Element
  //       }
  //     ).el instanceof SVGElement,
  //   )
  // })

  // test('force hydrate prop with `.prop` modifier', () => {
  //   const { container } = mountWithHydration('<input type="checkbox">', () =>
  //     h('input', {
  //       type: 'checkbox',
  //       '.indeterminate': true,
  //     }),
  //   )
  //   expect((container.firstChild! as any).indeterminate).toBe(true)
  // })

  // test('force hydrate input v-model with non-string value bindings', () => {
  //   const { container } = mountWithHydration(
  //     '<input type="checkbox" value="true">',
  //     () =>
  //       withDirectives(
  //         createVNode(
  //           'input',
  //           { type: 'checkbox', 'true-value': true },
  //           null,
  //           PatchFlags.PROPS,
  //           ['true-value'],
  //         ),
  //         [[vModelCheckbox, true]],
  //       ),
  //   )
  //   expect((container.firstChild as any)._trueValue).toBe(true)
  // })

  // test('force hydrate checkbox with indeterminate', () => {
  //   const { container } = mountWithHydration(
  //     '<input type="checkbox" indeterminate>',
  //     () =>
  //       createVNode(
  //         'input',
  //         { type: 'checkbox', indeterminate: '' },
  //         null,
  //         PatchFlags.CACHED,
  //       ),
  //   )
  //   expect((container.firstChild as any).indeterminate).toBe(true)
  // })

  // test('force hydrate select option with non-string value bindings', () => {
  //   const { container } = mountWithHydration(
  //     '<select><option value="true">ok</option></select>',
  //     () =>
  //       h('select', [
  //         // hoisted because bound value is a constant...
  //         createVNode('option', { value: true }, null, -1 /* HOISTED */),
  //       ]),
  //   )
  //   expect((container.firstChild!.firstChild as any)._value).toBe(true)
  // })

  // // #7203
  // test('force hydrate custom element with dynamic props', () => {
  //   class MyElement extends HTMLElement {
  //     foo = ''
  //     constructor() {
  //       super()
  //     }
  //   }
  //   customElements.define('my-element-7203', MyElement)

  //   const msg = ref('bar')
  //   const container = document.createElement('div')
  //   container.innerHTML = '<my-element-7203></my-element-7203>'
  //   const app = createSSRApp({
  //     render: () => h('my-element-7203', { foo: msg.value }),
  //   })
  //   app.mount(container)
  //   expect((container.firstChild as any).foo).toBe(msg.value)
  // })

  // // #5728
  // test('empty text node in slot', () => {
  //   const Comp = {
  //     render(this: any) {
  //       return renderSlot(this.$slots, 'default', {}, () => [
  //         createTextVNode(''),
  //       ])
  //     },
  //   }
  //   const { container, vnode } = mountWithHydration('<!--[--><!--]-->', () =>
  //     h(Comp),
  //   )
  //   expect(container.childNodes.length).toBe(3)
  //   const text = container.childNodes[1]
  //   expect(text.nodeType).toBe(3)
  //   expect(vnode.el).toBe(container.childNodes[0])
  //   // component => slot fragment => text node
  //   expect((vnode as any).component?.subTree.children[0].el).toBe(text)
  // })

  // // #7215
  // test('empty text node', () => {
  //   const Comp = {
  //     render(this: any) {
  //       return h('p', [''])
  //     },
  //   }
  //   const { container } = mountWithHydration('<p></p>', () => h(Comp))
  //   expect(container.childNodes.length).toBe(1)
  //   const p = container.childNodes[0]
  //   expect(p.childNodes.length).toBe(1)
  //   const text = p.childNodes[0]
  //   expect(text.nodeType).toBe(3)
  // })

  // // #11372
  // test('object style value tracking in prod', async () => {
  //   __DEV__ = false
  //   try {
  //     const style = reactive({ color: 'red' })
  //     const Comp = {
  //       render(this: any) {
  //         return (
  //           openBlock(),
  //           createElementBlock(
  //             'div',
  //             {
  //               style: normalizeStyle(style),
  //             },
  //             null,
  //             4 /* STYLE */,
  //           )
  //         )
  //       },
  //     }
  //     const { container } = mountWithHydration(
  //       `<div style="color: red;"></div>`,
  //       () => h(Comp),
  //     )
  //     style.color = 'green'
  //     await nextTick()
  //     expect(container.innerHTML).toBe(`<div style="color: green;"></div>`)
  //   } finally {
  //     __DEV__ = true
  //   }
  // })

  // test('app.unmount()', async () => {
  //   const container = document.createElement('DIV')
  //   container.innerHTML = '<button></button>'
  //   const App = defineComponent({
  //     setup(_, { expose }) {
  //       const count = ref(0)

  //       expose({ count })

  //       return () =>
  //         h('button', {
  //           onClick: () => count.value++,
  //         })
  //     },
  //   })

  //   const app = createSSRApp(App)
  //   const vm = app.mount(container)
  //   await nextTick()
  //   expect((container as any)._vnode).toBeDefined()
  //   // @ts-expect-error - expose()'d properties are not available on vm type
  //   expect(vm.count).toBe(0)

  //   app.unmount()
  //   expect((container as any)._vnode).toBe(null)
  // })

  // // #6637
  // test('stringified root fragment', () => {
  //   mountWithHydration(`<!--[--><div></div><!--]-->`, () =>
  //     createStaticVNode(`<div></div>`, 1),
  //   )
  //   expect(`mismatch`).not.toHaveBeenWarned()
  // })

  // test('transition appear', () => {
  //   const { vnode, container } = mountWithHydration(
  //     `<template><div>foo</div></template>`,
  //     () =>
  //       h(
  //         Transition,
  //         { appear: true },
  //         {
  //           default: () => h('div', 'foo'),
  //         },
  //       ),
  //   )
  //   expect(container.firstChild).toMatchInlineSnapshot(`
  //     <div
  //       class="v-enter-from v-enter-active"
  //     >
  //       foo
  //     </div>
  //   `)
  //   expect(vnode.el).toBe(container.firstChild)
  //   expect(`mismatch`).not.toHaveBeenWarned()
  // })

  // test('transition appear with v-if', () => {
  //   const show = false
  //   const { vnode, container } = mountWithHydration(
  //     `<template><!----></template>`,
  //     () =>
  //       h(
  //         Transition,
  //         { appear: true },
  //         {
  //           default: () => (show ? h('div', 'foo') : createCommentVNode('')),
  //         },
  //       ),
  //   )
  //   expect(container.firstChild).toMatchInlineSnapshot('<!---->')
  //   expect(vnode.el).toBe(container.firstChild)
  //   expect(`mismatch`).not.toHaveBeenWarned()
  // })

  // test('transition appear with v-show', () => {
  //   const show = false
  //   const { vnode, container } = mountWithHydration(
  //     `<template><div style="display: none;">foo</div></template>`,
  //     () =>
  //       h(
  //         Transition,
  //         { appear: true },
  //         {
  //           default: () =>
  //             withDirectives(createVNode('div', null, 'foo'), [[vShow, show]]),
  //         },
  //       ),
  //   )
  //   expect(container.firstChild).toMatchInlineSnapshot(`
  //     <div
  //       class="v-enter-from v-enter-active"
  //       style="display: none;"
  //     >
  //       foo
  //     </div>
  //   `)
  //   expect((container.firstChild as any)[vShowOriginalDisplay]).toBe('')
  //   expect(vnode.el).toBe(container.firstChild)
  //   expect(`mismatch`).not.toHaveBeenWarned()
  // })

  // test('transition appear w/ event listener', async () => {
  //   const container = document.createElement('div')
  //   container.innerHTML = `<template><button>0</button></template>`
  //   createSSRApp({
  //     data() {
  //       return {
  //         count: 0,
  //       }
  //     },
  //     template: `
  //       <Transition appear>
  //         <button @click="count++">{{count}}</button>
  //       </Transition>
  //     `,
  //   }).mount(container)

  //   expect(container.firstChild).toMatchInlineSnapshot(`
  //     <button
  //       class="v-enter-from v-enter-active"
  //     >
  //       0
  //     </button>
  //   `)

  //   triggerEvent('click', container.querySelector('button')!)
  //   await nextTick()
  //   expect(container.firstChild).toMatchInlineSnapshot(`
  //     <button
  //       class="v-enter-from v-enter-active"
  //     >
  //       1
  //     </button>
  //   `)
  // })

  // test('Suspense + transition appear', async () => {
  //   const { vnode, container } = mountWithHydration(
  //     `<template><div>foo</div></template>`,
  //     () =>
  //       h(Suspense, {}, () =>
  //         h(
  //           Transition,
  //           { appear: true },
  //           {
  //             default: () => h('div', 'foo'),
  //           },
  //         ),
  //       ),
  //   )

  //   expect(vnode.el).toBe(container.firstChild)
  //   // wait for hydration to finish
  //   await new Promise(r => setTimeout(r))

  //   expect(container.firstChild).toMatchInlineSnapshot(`
  //     <div
  //       class="v-enter-from v-enter-active"
  //     >
  //       foo
  //     </div>
  //   `)
  //   await nextTick()
  //   expect(vnode.el).toBe(container.firstChild)
  // })

  // // #10607
  // test('update component stable slot (prod + optimized mode)', async () => {
  //   __DEV__ = false
  //   try {
  //     const container = document.createElement('div')
  //     container.innerHTML = `<template><div show="false"><!--[--><div><div><!----></div></div><div>0</div><!--]--></div></template>`
  //     const Comp = {
  //       render(this: any) {
  //         return (
  //           openBlock(),
  //           createElementBlock('div', null, [
  //             renderSlot(this.$slots, 'default'),
  //           ])
  //         )
  //       },
  //     }
  //     const show = ref(false)
  //     const clicked = ref(false)

  //     const Wrapper = {
  //       setup() {
  //         const items = ref<number[]>([])
  //         onMounted(() => {
  //           items.value = [1]
  //         })
  //         return () => {
  //           return (
  //             openBlock(),
  //             createBlock(Comp, null, {
  //               default: withCtx(() => [
  //                 createElementVNode('div', null, [
  //                   createElementVNode('div', null, [
  //                     clicked.value
  //                       ? (openBlock(),
  //                         createElementBlock('div', { key: 0 }, 'foo'))
  //                       : createCommentVNode('v-if', true),
  //                   ]),
  //                 ]),
  //                 createElementVNode(
  //                   'div',
  //                   null,
  //                   items.value.length,
  //                   1 /* TEXT */,
  //                 ),
  //               ]),
  //               _: 1 /* STABLE */,
  //             })
  //           )
  //         }
  //       },
  //     }
  //     createSSRApp({
  //       components: { Wrapper },
  //       data() {
  //         return { show }
  //       },
  //       template: `<Wrapper :show="show"/>`,
  //     }).mount(container)

  //     await nextTick()
  //     expect(container.innerHTML).toBe(
  //       `<div show="false"><!--[--><div><div><!----></div></div><div>1</div><!--]--></div>`,
  //     )

  //     show.value = true
  //     await nextTick()
  //     expect(async () => {
  //       clicked.value = true
  //       await nextTick()
  //     }).not.toThrow("Cannot read properties of null (reading 'insertBefore')")

  //     await nextTick()
  //     expect(container.innerHTML).toBe(
  //       `<div show="true"><!--[--><div><div><div>foo</div></div></div><div>1</div><!--]--></div>`,
  //     )
  //   } catch (e) {
  //     throw e
  //   } finally {
  //     __DEV__ = true
  //   }
  // })

  // describe('mismatch handling', () => {
  //   test('text node', () => {
  //     const { container } = mountWithHydration(`foo`, () => 'bar')
  //     expect(container.textContent).toBe('bar')
  //     expect(`Hydration text mismatch`).toHaveBeenWarned()
  //   })

  //   test('element text content', () => {
  //     const { container } = mountWithHydration(`<div>foo</div>`, () =>
  //       h('div', 'bar'),
  //     )
  //     expect(container.innerHTML).toBe('<div>bar</div>')
  //     expect(`Hydration text content mismatch`).toHaveBeenWarned()
  //   })

  //   test('not enough children', () => {
  //     const { container } = mountWithHydration(`<div></div>`, () =>
  //       h('div', [h('span', 'foo'), h('span', 'bar')]),
  //     )
  //     expect(container.innerHTML).toBe(
  //       '<div><span>foo</span><span>bar</span></div>',
  //     )
  //     expect(`Hydration children mismatch`).toHaveBeenWarned()
  //   })

  //   test('too many children', () => {
  //     const { container } = mountWithHydration(
  //       `<div><span>foo</span><span>bar</span></div>`,
  //       () => h('div', [h('span', 'foo')]),
  //     )
  //     expect(container.innerHTML).toBe('<div><span>foo</span></div>')
  //     expect(`Hydration children mismatch`).toHaveBeenWarned()
  //   })

  //   test('complete mismatch', () => {
  //     const { container } = mountWithHydration(
  //       `<div><span>foo</span><span>bar</span></div>`,
  //       () => h('div', [h('div', 'foo'), h('p', 'bar')]),
  //     )
  //     expect(container.innerHTML).toBe('<div><div>foo</div><p>bar</p></div>')
  //     expect(`Hydration node mismatch`).toHaveBeenWarnedTimes(2)
  //   })

  //   test('fragment mismatch removal', () => {
  //     const { container } = mountWithHydration(
  //       `<div><!--[--><div>foo</div><div>bar</div><!--]--></div>`,
  //       () => h('div', [h('span', 'replaced')]),
  //     )
  //     expect(container.innerHTML).toBe('<div><span>replaced</span></div>')
  //     expect(`Hydration node mismatch`).toHaveBeenWarned()
  //   })

  //   test('fragment not enough children', () => {
  //     const { container } = mountWithHydration(
  //       `<div><!--[--><div>foo</div><!--]--><div>baz</div></div>`,
  //       () => h('div', [[h('div', 'foo'), h('div', 'bar')], h('div', 'baz')]),
  //     )
  //     expect(container.innerHTML).toBe(
  //       '<div><!--[--><div>foo</div><div>bar</div><!--]--><div>baz</div></div>',
  //     )
  //     expect(`Hydration node mismatch`).toHaveBeenWarned()
  //   })

  //   test('fragment too many children', () => {
  //     const { container } = mountWithHydration(
  //       `<div><!--[--><div>foo</div><div>bar</div><!--]--><div>baz</div></div>`,
  //       () => h('div', [[h('div', 'foo')], h('div', 'baz')]),
  //     )
  //     expect(container.innerHTML).toBe(
  //       '<div><!--[--><div>foo</div><!--]--><div>baz</div></div>',
  //     )
  //     // fragment ends early and attempts to hydrate the extra <div>bar</div>
  //     // as 2nd fragment child.
  //     expect(`Hydration text content mismatch`).toHaveBeenWarned()
  //     // excessive children removal
  //     expect(`Hydration children mismatch`).toHaveBeenWarned()
  //   })

  //   test('Teleport target has empty children', () => {
  //     const teleportContainer = document.createElement('div')
  //     teleportContainer.id = 'teleport'
  //     document.body.appendChild(teleportContainer)

  //     mountWithHydration('<!--teleport start--><!--teleport end-->', () =>
  //       h(Teleport, { to: '#teleport' }, [h('span', 'value')]),
  //     )
  //     expect(teleportContainer.innerHTML).toBe(`<span>value</span>`)
  //     expect(`Hydration children mismatch`).toHaveBeenWarned()
  //   })

  //   test('comment mismatch (element)', () => {
  //     const { container } = mountWithHydration(`<div><span></span></div>`, () =>
  //       h('div', [createCommentVNode('hi')]),
  //     )
  //     expect(container.innerHTML).toBe('<div><!--hi--></div>')
  //     expect(`Hydration node mismatch`).toHaveBeenWarned()
  //   })

  //   test('comment mismatch (text)', () => {
  //     const { container } = mountWithHydration(`<div>foobar</div>`, () =>
  //       h('div', [createCommentVNode('hi')]),
  //     )
  //     expect(container.innerHTML).toBe('<div><!--hi--></div>')
  //     expect(`Hydration node mismatch`).toHaveBeenWarned()
  //   })

  //   test('class mismatch', () => {
  //     mountWithHydration(`<div class="foo bar"></div>`, () =>
  //       h('div', { class: ['foo', 'bar'] }),
  //     )
  //     mountWithHydration(`<div class="foo bar"></div>`, () =>
  //       h('div', { class: { foo: true, bar: true } }),
  //     )
  //     mountWithHydration(`<div class="foo bar"></div>`, () =>
  //       h('div', { class: 'foo bar' }),
  //     )
  //     // SVG classes
  //     mountWithHydration(`<svg class="foo bar"></svg>`, () =>
  //       h('svg', { class: 'foo bar' }),
  //     )
  //     // class with different order
  //     mountWithHydration(`<div class="foo bar"></div>`, () =>
  //       h('div', { class: 'bar foo' }),
  //     )
  //     expect(`Hydration class mismatch`).not.toHaveBeenWarned()
  //     mountWithHydration(`<div class="foo bar"></div>`, () =>
  //       h('div', { class: 'foo' }),
  //     )
  //     expect(`Hydration class mismatch`).toHaveBeenWarned()
  //   })

  //   test('style mismatch', () => {
  //     mountWithHydration(`<div style="color:red;"></div>`, () =>
  //       h('div', { style: { color: 'red' } }),
  //     )
  //     mountWithHydration(`<div style="color:red;"></div>`, () =>
  //       h('div', { style: `color:red;` }),
  //     )
  //     mountWithHydration(
  //       `<div style="color:red; font-size: 12px;"></div>`,
  //       () => h('div', { style: `font-size: 12px; color:red;` }),
  //     )
  //     mountWithHydration(`<div style="color:red;display:none;"></div>`, () =>
  //       withDirectives(createVNode('div', { style: 'color: red' }, ''), [
  //         [vShow, false],
  //       ]),
  //     )
  //     expect(`Hydration style mismatch`).not.toHaveBeenWarned()
  //     mountWithHydration(`<div style="color:red;"></div>`, () =>
  //       h('div', { style: { color: 'green' } }),
  //     )
  //     expect(`Hydration style mismatch`).toHaveBeenWarnedTimes(1)
  //   })

  //   test('style mismatch when no style attribute is present', () => {
  //     mountWithHydration(`<div></div>`, () =>
  //       h('div', { style: { color: 'red' } }),
  //     )
  //     expect(`Hydration style mismatch`).toHaveBeenWarnedTimes(1)
  //   })

  //   test('style mismatch w/ v-show', () => {
  //     mountWithHydration(`<div style="color:red;display:none"></div>`, () =>
  //       withDirectives(createVNode('div', { style: 'color: red' }, ''), [
  //         [vShow, false],
  //       ]),
  //     )
  //     expect(`Hydration style mismatch`).not.toHaveBeenWarned()
  //     mountWithHydration(`<div style="color:red;"></div>`, () =>
  //       withDirectives(createVNode('div', { style: 'color: red' }, ''), [
  //         [vShow, false],
  //       ]),
  //     )
  //     expect(`Hydration style mismatch`).toHaveBeenWarnedTimes(1)
  //   })

  //   test('attr mismatch', () => {
  //     mountWithHydration(`<div id="foo"></div>`, () => h('div', { id: 'foo' }))
  //     mountWithHydration(`<div spellcheck></div>`, () =>
  //       h('div', { spellcheck: '' }),
  //     )
  //     mountWithHydration(`<div></div>`, () => h('div', { id: undefined }))
  //     // boolean
  //     mountWithHydration(`<select multiple></div>`, () =>
  //       h('select', { multiple: true }),
  //     )
  //     mountWithHydration(`<select multiple></div>`, () =>
  //       h('select', { multiple: 'multiple' }),
  //     )
  //     expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()

  //     mountWithHydration(`<div></div>`, () => h('div', { id: 'foo' }))
  //     expect(`Hydration attribute mismatch`).toHaveBeenWarnedTimes(1)

  //     mountWithHydration(`<div id="bar"></div>`, () => h('div', { id: 'foo' }))
  //     expect(`Hydration attribute mismatch`).toHaveBeenWarnedTimes(2)
  //   })

  //   test('attr special case: textarea value', () => {
  //     mountWithHydration(`<textarea>foo</textarea>`, () =>
  //       h('textarea', { value: 'foo' }),
  //     )
  //     mountWithHydration(`<textarea></textarea>`, () =>
  //       h('textarea', { value: '' }),
  //     )
  //     expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()

  //     mountWithHydration(`<textarea>foo</textarea>`, () =>
  //       h('textarea', { value: 'bar' }),
  //     )
  //     expect(`Hydration attribute mismatch`).toHaveBeenWarned()
  //   })

  //   // #11873
  //   test('<textarea> with newlines at the beginning', async () => {
  //     const render = () => h('textarea', null, '\nhello')
  //     const html = await renderToString(createSSRApp({ render }))
  //     mountWithHydration(html, render)
  //     expect(`Hydration text content mismatch`).not.toHaveBeenWarned()
  //   })

  //   test('<pre> with newlines at the beginning', async () => {
  //     const render = () => h('pre', null, '\n')
  //     const html = await renderToString(createSSRApp({ render }))
  //     mountWithHydration(html, render)
  //     expect(`Hydration text content mismatch`).not.toHaveBeenWarned()
  //   })

  //   test('boolean attr handling', () => {
  //     mountWithHydration(`<input />`, () => h('input', { readonly: false }))
  //     expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()

  //     mountWithHydration(`<input readonly />`, () =>
  //       h('input', { readonly: true }),
  //     )
  //     expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()

  //     mountWithHydration(`<input readonly="readonly" />`, () =>
  //       h('input', { readonly: true }),
  //     )
  //     expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()
  //   })

  //   test('client value is null or undefined', () => {
  //     mountWithHydration(`<div></div>`, () =>
  //       h('div', { draggable: undefined }),
  //     )
  //     expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()

  //     mountWithHydration(`<input />`, () => h('input', { type: null }))
  //     expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()
  //   })

  //   test('should not warn against object values', () => {
  //     mountWithHydration(`<input />`, () => h('input', { from: {} }))
  //     expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()
  //   })

  //   test('should not warn on falsy bindings of non-property keys', () => {
  //     mountWithHydration(`<button />`, () => h('button', { href: undefined }))
  //     expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()
  //   })

  //   test('should not warn on non-renderable option values', () => {
  //     mountWithHydration(`<select><option>hello</option></select>`, () =>
  //       h('select', [h('option', { value: ['foo'] }, 'hello')]),
  //     )
  //     expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()
  //   })

  //   test('should not warn css v-bind', () => {
  //     const container = document.createElement('div')
  //     container.innerHTML = `<div style="--foo:red;color:var(--foo);" />`
  //     const app = createSSRApp({
  //       setup() {
  //         useCssVars(() => ({
  //           foo: 'red',
  //         }))
  //         return () => h('div', { style: { color: 'var(--foo)' } })
  //       },
  //     })
  //     app.mount(container)
  //     expect(`Hydration style mismatch`).not.toHaveBeenWarned()
  //   })

  //   // #10317 - test case from #10325
  //   test('css vars should only be added to expected on component root dom', () => {
  //     const container = document.createElement('div')
  //     container.innerHTML = `<div style="--foo:red;"><div style="color:var(--foo);" /></div>`
  //     const app = createSSRApp({
  //       setup() {
  //         useCssVars(() => ({
  //           foo: 'red',
  //         }))
  //         return () =>
  //           h('div', null, [h('div', { style: { color: 'var(--foo)' } })])
  //       },
  //     })
  //     app.mount(container)
  //     expect(`Hydration style mismatch`).not.toHaveBeenWarned()
  //   })

  //   // #11188
  //   test('css vars support fallthrough', () => {
  //     const container = document.createElement('div')
  //     container.innerHTML = `<div style="padding: 4px;--foo:red;"></div>`
  //     const app = createSSRApp({
  //       setup() {
  //         useCssVars(() => ({
  //           foo: 'red',
  //         }))
  //         return () => h(Child)
  //       },
  //     })
  //     const Child = {
  //       setup() {
  //         return () => h('div', { style: 'padding: 4px' })
  //       },
  //     }
  //     app.mount(container)
  //     expect(`Hydration style mismatch`).not.toHaveBeenWarned()
  //   })

  //   // #11189
  //   test('should not warn for directives that mutate DOM in created', () => {
  //     const container = document.createElement('div')
  //     container.innerHTML = `<div class="test red"></div>`
  //     const vColor: ObjectDirective = {
  //       created(el, binding) {
  //         el.classList.add(binding.value)
  //       },
  //     }
  //     const app = createSSRApp({
  //       setup() {
  //         return () =>
  //           withDirectives(h('div', { class: 'test' }), [[vColor, 'red']])
  //       },
  //     })
  //     app.mount(container)
  //     expect(`Hydration style mismatch`).not.toHaveBeenWarned()
  //   })

  //   test('escape css var name', () => {
  //     const container = document.createElement('div')
  //     container.innerHTML = `<div style="padding: 4px;--foo\\.bar:red;"></div>`
  //     const app = createSSRApp({
  //       setup() {
  //         useCssVars(() => ({
  //           'foo.bar': 'red',
  //         }))
  //         return () => h(Child)
  //       },
  //     })
  //     const Child = {
  //       setup() {
  //         return () => h('div', { style: 'padding: 4px' })
  //       },
  //     }
  //     app.mount(container)
  //     expect(`Hydration style mismatch`).not.toHaveBeenWarned()
  //   })
  // })

  // describe('data-allow-mismatch', () => {
  //   test('element text content', () => {
  //     const { container } = mountWithHydration(
  //       `<div data-allow-mismatch="text">foo</div>`,
  //       () => h('div', 'bar'),
  //     )
  //     expect(container.innerHTML).toBe(
  //       '<div data-allow-mismatch="text">bar</div>',
  //     )
  //     expect(`Hydration text content mismatch`).not.toHaveBeenWarned()
  //   })

  //   test('not enough children', () => {
  //     const { container } = mountWithHydration(
  //       `<div data-allow-mismatch="children"></div>`,
  //       () => h('div', [h('span', 'foo'), h('span', 'bar')]),
  //     )
  //     expect(container.innerHTML).toBe(
  //       '<div data-allow-mismatch="children"><span>foo</span><span>bar</span></div>',
  //     )
  //     expect(`Hydration children mismatch`).not.toHaveBeenWarned()
  //   })

  //   test('too many children', () => {
  //     const { container } = mountWithHydration(
  //       `<div data-allow-mismatch="children"><span>foo</span><span>bar</span></div>`,
  //       () => h('div', [h('span', 'foo')]),
  //     )
  //     expect(container.innerHTML).toBe(
  //       '<div data-allow-mismatch="children"><span>foo</span></div>',
  //     )
  //     expect(`Hydration children mismatch`).not.toHaveBeenWarned()
  //   })

  //   test('complete mismatch', () => {
  //     const { container } = mountWithHydration(
  //       `<div data-allow-mismatch="children"><span>foo</span><span>bar</span></div>`,
  //       () => h('div', [h('div', 'foo'), h('p', 'bar')]),
  //     )
  //     expect(container.innerHTML).toBe(
  //       '<div data-allow-mismatch="children"><div>foo</div><p>bar</p></div>',
  //     )
  //     expect(`Hydration node mismatch`).not.toHaveBeenWarned()
  //   })

  //   test('fragment mismatch removal', () => {
  //     const { container } = mountWithHydration(
  //       `<div data-allow-mismatch="children"><!--[--><div>foo</div><div>bar</div><!--]--></div>`,
  //       () => h('div', [h('span', 'replaced')]),
  //     )
  //     expect(container.innerHTML).toBe(
  //       '<div data-allow-mismatch="children"><span>replaced</span></div>',
  //     )
  //     expect(`Hydration node mismatch`).not.toHaveBeenWarned()
  //   })

  //   test('fragment not enough children', () => {
  //     const { container } = mountWithHydration(
  //       `<div data-allow-mismatch="children"><!--[--><div>foo</div><!--]--><div>baz</div></div>`,
  //       () => h('div', [[h('div', 'foo'), h('div', 'bar')], h('div', 'baz')]),
  //     )
  //     expect(container.innerHTML).toBe(
  //       '<div data-allow-mismatch="children"><!--[--><div>foo</div><div>bar</div><!--]--><div>baz</div></div>',
  //     )
  //     expect(`Hydration node mismatch`).not.toHaveBeenWarned()
  //   })

  //   test('fragment too many children', () => {
  //     const { container } = mountWithHydration(
  //       `<div data-allow-mismatch="children"><!--[--><div>foo</div><div>bar</div><!--]--><div>baz</div></div>`,
  //       () => h('div', [[h('div', 'foo')], h('div', 'baz')]),
  //     )
  //     expect(container.innerHTML).toBe(
  //       '<div data-allow-mismatch="children"><!--[--><div>foo</div><!--]--><div>baz</div></div>',
  //     )
  //     // fragment ends early and attempts to hydrate the extra <div>bar</div>
  //     // as 2nd fragment child.
  //     expect(`Hydration text content mismatch`).not.toHaveBeenWarned()
  //     // excessive children removal
  //     expect(`Hydration children mismatch`).not.toHaveBeenWarned()
  //   })

  //   test('comment mismatch (element)', () => {
  //     const { container } = mountWithHydration(
  //       `<div data-allow-mismatch="children"><span></span></div>`,
  //       () => h('div', [createCommentVNode('hi')]),
  //     )
  //     expect(container.innerHTML).toBe(
  //       '<div data-allow-mismatch="children"><!--hi--></div>',
  //     )
  //     expect(`Hydration node mismatch`).not.toHaveBeenWarned()
  //   })

  //   test('comment mismatch (text)', () => {
  //     const { container } = mountWithHydration(
  //       `<div data-allow-mismatch="children">foobar</div>`,
  //       () => h('div', [createCommentVNode('hi')]),
  //     )
  //     expect(container.innerHTML).toBe(
  //       '<div data-allow-mismatch="children"><!--hi--></div>',
  //     )
  //     expect(`Hydration node mismatch`).not.toHaveBeenWarned()
  //   })

  //   test('class mismatch', () => {
  //     mountWithHydration(
  //       `<div class="foo bar" data-allow-mismatch="class"></div>`,
  //       () => h('div', { class: 'foo' }),
  //     )
  //     expect(`Hydration class mismatch`).not.toHaveBeenWarned()
  //   })

  //   test('style mismatch', () => {
  //     mountWithHydration(
  //       `<div style="color:red;" data-allow-mismatch="style"></div>`,
  //       () => h('div', { style: { color: 'green' } }),
  //     )
  //     expect(`Hydration style mismatch`).not.toHaveBeenWarned()
  //   })

  //   test('attr mismatch', () => {
  //     mountWithHydration(`<div data-allow-mismatch="attribute"></div>`, () =>
  //       h('div', { id: 'foo' }),
  //     )
  //     mountWithHydration(
  //       `<div id="bar" data-allow-mismatch="attribute"></div>`,
  //       () => h('div', { id: 'foo' }),
  //     )
  //     expect(`Hydration attribute mismatch`).not.toHaveBeenWarned()
  //   })
  // })

  test.todo('Teleport')
  test.todo('Suspense')
})
