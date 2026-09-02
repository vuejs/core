import {
  createVaporSSRApp,
  defineVaporAsyncComponent,
  template,
} from '../../src'
import {
  defineAsyncComponent,
  defineComponent,
  h,
  nextTick,
  ref,
} from '@vue/runtime-dom'
import { VueServerRenderer, runtimeDom, runtimeVapor } from '../_utils'
import {
  hydrateNode,
  setIsHydratingEnabled,
  withDeferredHydrationBoundary,
} from '../../src/dom/hydration'
import { DynamicFragment } from '../../src/fragment'
import { IF } from '../../src/fragmentFlags'
import {
  compileVaporComponent,
  formatHtml,
  setupHydrationTest,
  triggerEvent,
} from './_helpers'

setupHydrationTest()

describe('Vapor Mode hydration', () => {
  describe('async component', async () => {
    test('async component', async () => {
      const data = ref({
        spy: vi.fn(),
      })

      const compCode = `<button @click="data.spy">hello!</button>`
      const SSRComp = compileVaporComponent(compCode, data, undefined, true)
      let serverResolve: any
      // use defineAsyncComponent in SSR
      let AsyncComp = defineAsyncComponent(
        () =>
          new Promise(r => {
            serverResolve = r
          }),
      )
      const appCode = `hello<components.AsyncComp/>world`
      const SSRApp = compileVaporComponent(appCode, data, { AsyncComp }, true)

      // server render
      const htmlPromise = VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(SSRApp),
      )
      serverResolve(SSRComp)
      const html = await htmlPromise
      expect(html).toMatchInlineSnapshot(
        `"<!--[-->hello<button>hello!</button>world<!--]-->"`,
      )

      // hydration
      let clientResolve: any
      AsyncComp = defineVaporAsyncComponent(
        () =>
          new Promise(r => {
            clientResolve = r
          }),
      ) as any

      const Comp = compileVaporComponent(compCode, data)
      const App = compileVaporComponent(appCode, data, { AsyncComp })

      const container = document.createElement('div')
      container.innerHTML = html
      document.body.appendChild(container)
      createVaporSSRApp(App).mount(container)

      // hydration not complete yet
      triggerEvent('click', container.querySelector('button')!)
      expect(data.value.spy).not.toHaveBeenCalled()

      // resolve
      clientResolve(Comp)
      await new Promise(r => setTimeout(r))

      // should be hydrated now
      triggerEvent('click', container.querySelector('button')!)
      expect(data.value.spy).toHaveBeenCalled()
    })

    test('updates an earlier branch from sibling beforeMount during async component hydration', async () => {
      const data = ref({ show: true })
      const innerCode = `
        <div v-if="data.show">A</div>
        <components.Mutator />
      `
      const mutatorCode = `
        <script vapor>
          import { onBeforeMount } from 'vue'
          const data = _data
          onBeforeMount(() => {
            data.value.show = false
          })
        </script>
        <template><span>tail</span></template>
      `
      const appCode = `<components.AsyncComp />`

      const SSRMutator = compileVaporComponent(
        mutatorCode,
        data,
        undefined,
        true,
      )
      const SSRInner = compileVaporComponent(
        innerCode,
        data,
        { Mutator: SSRMutator },
        true,
      )
      const SSRAsyncComp = defineAsyncComponent(() => Promise.resolve(SSRInner))
      const SSRApp = compileVaporComponent(
        appCode,
        data,
        { AsyncComp: SSRAsyncComp },
        true,
      )
      const html = await VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(SSRApp),
      )

      const Mutator = compileVaporComponent(mutatorCode, data)
      const Inner = compileVaporComponent(innerCode, data, { Mutator })
      let clientResolve: (comp: any) => void
      const AsyncComp = defineVaporAsyncComponent(
        () =>
          new Promise(resolve => {
            clientResolve = resolve
          }),
      )
      const App = compileVaporComponent(appCode, data, { AsyncComp })
      const container = document.createElement('div')
      container.innerHTML = html
      document.body.appendChild(container)
      const errorHandler = vi.fn()
      const app = createVaporSSRApp(App)
      app.config.errorHandler = errorHandler
      app.mount(container)

      clientResolve!(Inner)
      await new Promise(resolve => setTimeout(resolve))
      await nextTick()

      expect(errorHandler).not.toHaveBeenCalled()
      expect(container.textContent).toBe('tail')

      data.value.show = true
      await nextTick()
      expect(errorHandler).not.toHaveBeenCalled()
      expect(container.textContent).toBe('Atail')
    })

    // No longer needed, parent component updates in vapor mode no longer
    // cause child components to re-render
    // test.todo('update async wrapper before resolve', async () => {})

    test('update async component after parent mount before async component resolve', async () => {
      const data = ref({
        toggle: true,
      })
      const compCode = `
          <script vapor>
            defineProps(['toggle'])
          </script>
          <template>
            <h1>{{ toggle ? 'Async component' : 'Updated async component' }}</h1>
          </template>
        `
      const SSRComp = compileVaporComponent(
        compCode,
        undefined,
        undefined,
        true,
      )
      let serverResolve: any
      // use defineAsyncComponent in SSR
      let AsyncComp = defineAsyncComponent(
        () =>
          new Promise(r => {
            serverResolve = r
          }),
      )
      const appCode = `<components.AsyncComp :toggle="data.toggle"/>`
      const SSRApp = compileVaporComponent(appCode, data, { AsyncComp }, true)

      // server render
      const htmlPromise = VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(SSRApp),
      )
      serverResolve(SSRComp)
      const html = await htmlPromise
      expect(html).toMatchInlineSnapshot(`"<h1>Async component</h1>"`)

      // hydration
      let clientResolve: any
      AsyncComp = defineVaporAsyncComponent(
        () =>
          new Promise(r => {
            clientResolve = r
          }),
      ) as any

      const Comp = compileVaporComponent(compCode)
      const App = compileVaporComponent(appCode, data, { AsyncComp })

      const container = document.createElement('div')
      container.innerHTML = html
      document.body.appendChild(container)
      createVaporSSRApp(App).mount(container)

      // update before resolve
      data.value.toggle = false
      await nextTick()

      // resolve
      clientResolve(Comp)
      await new Promise(r => setTimeout(r))

      // vapor lazy hydration always proceeds; drift is corrected by the
      // mismatch handling path.
      expect(`Hydration text mismatch`).toHaveBeenWarned()
      expect(container.innerHTML).toMatchInlineSnapshot(
        `"<h1>Updated async component</h1><!--async component-->"`,
      )

      data.value.toggle = true
      await nextTick()
      expect(container.innerHTML).toMatchInlineSnapshot(
        `"<h1>Async component</h1><!--async component-->"`,
      )
    })

    test('deferred dynamic fragment reuses existing empty anchor when branch revives', async () => {
      const container = document.createElement('div')
      const anchor = document.createComment('if')
      container.append(anchor)

      setIsHydratingEnabled(true)
      try {
        hydrateNode(anchor, () => {
          const fragment = new DynamicFragment(IF, 'if', false, false)
          fragment.anchor = anchor
          withDeferredHydrationBoundary(() => {
            fragment.update(() => template('<span>foo</span>')())
          })
        })
      } finally {
        setIsHydratingEnabled(false)
      }
      await nextTick()

      expect(`Hydration node mismatch`).toHaveBeenWarned()
      expect(container.innerHTML).toBe('<span>foo</span><!--if-->')
      expect(container.lastChild).toBe(anchor)
    })

    test('update async component (fragment root) after parent mount before async component resolve', async () => {
      const data = ref({
        toggle: true,
      })
      const compCode = `
          <script vapor>
            defineProps(['toggle'])
          </script>
          <template>
            <h1>{{ toggle ? 'Async component' : 'Updated async component' }}</h1>
            <h2>fragment root</h2>
          </template>
        `
      const SSRComp = compileVaporComponent(
        compCode,
        undefined,
        undefined,
        true,
      )
      let serverResolve: any
      // use defineAsyncComponent in SSR
      let AsyncComp = defineAsyncComponent(
        () =>
          new Promise(r => {
            serverResolve = r
          }),
      )
      const appCode = `<components.AsyncComp :toggle="data.toggle"/>`
      const SSRApp = compileVaporComponent(appCode, data, { AsyncComp }, true)

      // server render
      const htmlPromise = VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(SSRApp),
      )
      serverResolve(SSRComp)
      const html = await htmlPromise
      expect(html).toMatchInlineSnapshot(
        `"<!--[--><h1>Async component</h1><h2>fragment root</h2><!--]-->"`,
      )

      // hydration
      let clientResolve: any
      AsyncComp = defineVaporAsyncComponent(
        () =>
          new Promise(r => {
            clientResolve = r
          }),
      ) as any

      const Comp = compileVaporComponent(compCode)
      const App = compileVaporComponent(appCode, data, { AsyncComp })

      const container = document.createElement('div')
      container.innerHTML = html
      document.body.appendChild(container)
      createVaporSSRApp(App).mount(container)

      // update before resolve
      data.value.toggle = false
      await nextTick()

      // resolve
      clientResolve(Comp)
      await new Promise(r => setTimeout(r))

      // vapor lazy hydration always proceeds; drift is corrected by the
      // mismatch handling path.
      expect(`Hydration text mismatch`).toHaveBeenWarned()
      expect(container.innerHTML).toMatchInlineSnapshot(
        `"<!--[--><h1>Updated async component</h1><h2>fragment root</h2><!--]--><!--async component-->"`,
      )
    })

    test('update async component fallthrough attrs after parent mount before async component resolve', async () => {
      const data = ref({
        cls: 'foo',
      })
      const compCode = `<div>Async component</div>`
      const SSRComp = compileVaporComponent(
        compCode,
        undefined,
        undefined,
        true,
      )
      let serverResolve: any
      let AsyncComp = defineAsyncComponent(
        () =>
          new Promise(r => {
            serverResolve = r
          }),
      )
      const appCode = `<components.AsyncComp :class="data.cls"/>`
      const SSRApp = compileVaporComponent(appCode, data, { AsyncComp }, true)

      const htmlPromise = VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(SSRApp),
      )
      serverResolve(SSRComp)
      const html = await htmlPromise
      expect(html).toMatchInlineSnapshot(
        `"<div class=\"foo\">Async component</div>"`,
      )

      let clientResolve: any
      AsyncComp = defineVaporAsyncComponent(
        () =>
          new Promise(r => {
            clientResolve = r
          }),
      ) as any

      const Comp = compileVaporComponent(compCode)
      const App = compileVaporComponent(appCode, data, { AsyncComp })

      const container = document.createElement('div')
      container.innerHTML = html
      document.body.appendChild(container)
      createVaporSSRApp(App).mount(container)

      data.value.cls = 'bar'
      await nextTick()

      clientResolve(Comp)
      await new Promise(r => setTimeout(r))

      expect(`Hydration class mismatch`).toHaveBeenWarned()
      expect(container.innerHTML).toMatchInlineSnapshot(
        `"<div class="foo">Async component</div><!--async component-->"`,
      )
    })

    test('update async component slot content after parent mount before async component resolve', async () => {
      const data = ref({
        msg: 'foo',
      })
      const compCode = `<div><slot/></div>`
      const SSRComp = compileVaporComponent(
        compCode,
        undefined,
        undefined,
        true,
      )
      let serverResolve: any
      let AsyncComp = defineAsyncComponent(
        () =>
          new Promise(r => {
            serverResolve = r
          }),
      )
      const appCode = `<components.AsyncComp><span>{{data.msg}}</span></components.AsyncComp>`
      const SSRApp = compileVaporComponent(appCode, data, { AsyncComp }, true)

      const htmlPromise = VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(SSRApp),
      )
      serverResolve(SSRComp)
      const html = await htmlPromise
      expect(formatHtml(html)).toMatchInlineSnapshot(`
      	"<div>
      	<!--[--><span>foo</span><!--]-->
      	</div>"
      `)

      let clientResolve: any
      AsyncComp = defineVaporAsyncComponent(
        () =>
          new Promise(r => {
            clientResolve = r
          }),
      ) as any

      const Comp = compileVaporComponent(compCode)
      const App = compileVaporComponent(appCode, data, { AsyncComp })

      const container = document.createElement('div')
      container.innerHTML = html
      document.body.appendChild(container)
      createVaporSSRApp(App).mount(container)

      data.value.msg = 'bar'
      await nextTick()

      clientResolve(Comp)
      await new Promise(r => setTimeout(r))

      expect(`Hydration text mismatch`).toHaveBeenWarned()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      	"<div>
      	<!--[--><span>bar</span><!--]-->
      	</div><!--async component-->"
      `)
    })

    test('update async component slot structure after parent mount before async component resolve', async () => {
      const data = ref({
        show: false,
        msg: 'bar',
      })
      const compCode = `<div><slot/></div>`
      const SSRComp = compileVaporComponent(
        compCode,
        undefined,
        undefined,
        true,
      )
      let serverResolve: any
      let AsyncComp = defineAsyncComponent(
        () =>
          new Promise(r => {
            serverResolve = r
          }),
      )
      const appCode = `<components.AsyncComp><span v-if="data.show">{{data.msg}}</span></components.AsyncComp>`
      const SSRApp = compileVaporComponent(appCode, data, { AsyncComp }, true)

      const htmlPromise = VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(SSRApp),
      )
      serverResolve(SSRComp)
      const html = await htmlPromise
      expect(formatHtml(html)).toMatchInlineSnapshot(`
      	"<div>
      	<!--[--><!--]-->
      	</div>"
      `)

      let clientResolve: any
      AsyncComp = defineVaporAsyncComponent(
        () =>
          new Promise(r => {
            clientResolve = r
          }),
      ) as any

      const Comp = compileVaporComponent(compCode)
      const App = compileVaporComponent(appCode, data, { AsyncComp })

      const container = document.createElement('div')
      container.innerHTML = html
      document.body.appendChild(container)
      createVaporSSRApp(App).mount(container)

      data.value.show = true
      await nextTick()

      clientResolve(Comp)
      await new Promise(r => setTimeout(r))

      expect(`Hydration node mismatch`).toHaveBeenWarned()
      expect(`Hydration text mismatch`).not.toHaveBeenWarned()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
        "<div>
        <!--[--><span>bar</span><!--if--><!--]-->
        <!--slot--></div><!--async component-->"
      `)
    })

    test('update async component slot single-root if with trailing sibling after parent mount before async component resolve', async () => {
      const data = ref({
        show: false,
        msg: 'bar',
        tail: 'tail',
      })
      const compCode = `<div><slot/></div>`
      const SSRComp = compileVaporComponent(
        compCode,
        undefined,
        undefined,
        true,
      )
      let serverResolve: any
      let AsyncComp = defineAsyncComponent(
        () =>
          new Promise(r => {
            serverResolve = r
          }),
      )
      const appCode = `<components.AsyncComp><span v-if="data.show">{{data.msg}}</span><i>{{data.tail}}</i></components.AsyncComp>`
      const SSRApp = compileVaporComponent(appCode, data, { AsyncComp }, true)

      const htmlPromise = VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(SSRApp),
      )
      serverResolve(SSRComp)
      const html = await htmlPromise
      expect(formatHtml(html)).toMatchInlineSnapshot(`
      	"<div>
      	<!--[--><!----><i>tail</i><!--]-->
      	</div>"
      `)

      let clientResolve: any
      AsyncComp = defineVaporAsyncComponent(
        () =>
          new Promise(r => {
            clientResolve = r
          }),
      ) as any

      const Comp = compileVaporComponent(compCode)
      const App = compileVaporComponent(appCode, data, { AsyncComp })

      const container = document.createElement('div')
      container.innerHTML = html
      document.body.appendChild(container)
      createVaporSSRApp(App).mount(container)

      data.value.show = true
      await nextTick()

      clientResolve(Comp)
      await new Promise(r => setTimeout(r))

      expect(`Hydration node mismatch`).toHaveBeenWarned()
      expect(`Hydration text mismatch`).not.toHaveBeenWarned()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      	"<div>
      	<!--[--><span>bar</span><!--if--><i>tail</i><!--]-->
      	</div><!--async component-->"
      `)
    })

    test('update async component slot content from empty v-for branch with trailing sibling after parent mount before async component resolve', async () => {
      const data = ref({
        items: [] as string[],
        tail: 'tail',
      })
      const compCode = `<div><slot/></div>`
      const SSRComp = compileVaporComponent(
        compCode,
        undefined,
        undefined,
        true,
      )
      let serverResolve: any
      let AsyncComp = defineAsyncComponent(
        () =>
          new Promise(r => {
            serverResolve = r
          }),
      )
      const appCode = `<components.AsyncComp><span v-for="item in data.items" :key="item">{{item}}</span><i>{{data.tail}}</i></components.AsyncComp>`
      const SSRApp = compileVaporComponent(appCode, data, { AsyncComp }, true)

      const htmlPromise = VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(SSRApp),
      )
      serverResolve(SSRComp)
      const html = await htmlPromise

      let clientResolve: any
      AsyncComp = defineVaporAsyncComponent(
        () =>
          new Promise(r => {
            clientResolve = r
          }),
      ) as any

      const Comp = compileVaporComponent(compCode)
      const App = compileVaporComponent(appCode, data, { AsyncComp })

      const container = document.createElement('div')
      container.innerHTML = html
      document.body.appendChild(container)
      createVaporSSRApp(App).mount(container)

      data.value.items = ['foo', 'bar']
      await nextTick()

      clientResolve(Comp)
      await new Promise(r => setTimeout(r))

      expect(`Hydration node mismatch`).toHaveBeenWarned()
      expect(`Hydration text mismatch`).not.toHaveBeenWarned()
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      	"<div>
      	<!--[-->
      	<!--[--><span>foo</span><span>bar</span><!--]-->
      	<i>tail</i><!--]-->
      	</div><!--async component-->"
      `)
    })

    test('trigger @vue:mounted for VDOM async component mounted after hydration', async () => {
      const data = ref({
        started: false,
        loaded: false,
      })
      const ResolvedComp = defineComponent({
        setup() {
          return () =>
            h('div', { id: 'docsearch' }, [
              h('button', { type: 'button' }, 'loaded'),
            ])
        },
      })
      const appCode = `
        <components.AsyncComp v-if="data.started" @vue:mounted="data.loaded = true" />
        <div v-if="!data.loaded" id="docsearch">placeholder</div>
      `
      const SSRApp = compileVaporComponent(
        appCode,
        data,
        { AsyncComp: ResolvedComp },
        true,
      )
      const html = await VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(SSRApp),
      )

      let clientResolve: any
      const AsyncComp = defineAsyncComponent(
        () =>
          new Promise(r => {
            clientResolve = r
          }),
      )

      const App = compileVaporComponent(appCode, data, { AsyncComp })

      const container = document.createElement('div')
      container.innerHTML = html
      document.body.appendChild(container)
      const app = createVaporSSRApp(App)
      app.use(runtimeVapor.vaporInteropPlugin)
      app.mount(container)

      expect(container.querySelectorAll('#docsearch')).toHaveLength(1)

      data.value.started = true
      await nextTick()
      clientResolve(ResolvedComp)
      await new Promise(r => setTimeout(r))
      await nextTick()

      expect(data.value.loaded).toBe(true)
      expect(container.querySelectorAll('#docsearch')).toHaveLength(1)
      expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
        "
        <!--[--><div id="docsearch"><button type="button">loaded</button></div><!----><!--if--><!--]-->
        "
      `)
    })

    test('hydrate vapor component inside VDOM async component resolved after hydration (interop)', async () => {
      const data = ref({
        spy: vi.fn(),
      })

      const compCode = `<button @click="data.spy">hello!</button>`
      const SSRComp = compileVaporComponent(compCode, data, undefined, true)
      const SSRAsyncComp = defineAsyncComponent(() => Promise.resolve(SSRComp))
      const SSRApp = defineComponent({
        render: () => h('div', [h(SSRAsyncComp)]),
      })
      const html = await VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(SSRApp),
      )
      expect(html).toMatchInlineSnapshot(`"<div><button>hello!</button></div>"`)

      let clientResolve: any
      const AsyncComp = defineAsyncComponent(
        () =>
          new Promise(r => {
            clientResolve = r
          }),
      )
      const App = defineComponent({
        render: () => h('div', [h(AsyncComp)]),
      })

      const Comp = compileVaporComponent(compCode, data)

      const container = document.createElement('div')
      container.innerHTML = html
      document.body.appendChild(container)
      const app = runtimeDom.createSSRApp(App)
      app.use(runtimeVapor.vaporInteropPlugin)
      app.mount(container)

      triggerEvent('click', container.querySelector('button')!)
      expect(data.value.spy).not.toHaveBeenCalled()

      clientResolve(Comp)
      await new Promise(r => setTimeout(r))

      triggerEvent('click', container.querySelector('button')!)
      expect(data.value.spy).toHaveBeenCalledTimes(1)
    })

    test('hydrate vapor component inside VDOM async component with lazy hydration strategy (interop)', async () => {
      const data = ref({
        spy: vi.fn(),
      })

      const compCode = `<button @click="data.spy">hello!</button>`
      const SSRComp = compileVaporComponent(compCode, data, undefined, true)
      const SSRAsyncComp = defineAsyncComponent(() => Promise.resolve(SSRComp))
      const SSRApp = defineComponent({
        render: () => h('div', [h(SSRAsyncComp)]),
      })
      const html = await VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(SSRApp),
      )

      const Comp = compileVaporComponent(compCode, data)
      let doHydrate: (() => void) | undefined
      const AsyncComp = defineAsyncComponent({
        loader: () => Promise.resolve(Comp) as any,
        hydrate(hydrate) {
          doHydrate = hydrate
          return () => {}
        },
      })
      const App = defineComponent({
        render: () => h('div', [h(AsyncComp)]),
      })

      const container = document.createElement('div')
      container.innerHTML = html
      document.body.appendChild(container)
      const app = runtimeDom.createSSRApp(App)
      app.use(runtimeVapor.vaporInteropPlugin)
      app.mount(container)
      await new Promise(r => setTimeout(r))

      triggerEvent('click', container.querySelector('button')!)
      expect(data.value.spy).not.toHaveBeenCalled()

      expect(doHydrate).toBeDefined()
      doHydrate!()
      await new Promise(r => setTimeout(r))

      triggerEvent('click', container.querySelector('button')!)
      expect(data.value.spy).toHaveBeenCalledTimes(1)
    })

    test('hydrate strategy applies to an async component created after its loader resolved', async () => {
      const data = ref({ spy: vi.fn() })
      const innerCode = `<button @click="data.spy">inner</button>`
      const outerCode = `<div><components.Inner/></div>`
      const appCode = `<components.Inner/><components.Outer/>`

      // server render
      const SSRInner = defineAsyncComponent(() =>
        Promise.resolve(
          compileVaporComponent(innerCode, data, undefined, true),
        ),
      )
      const SSROuter = defineAsyncComponent(() =>
        Promise.resolve(
          compileVaporComponent(outerCode, data, { Inner: SSRInner }, true),
        ),
      )
      const SSRApp = compileVaporComponent(
        appCode,
        data,
        { Inner: SSRInner, Outer: SSROuter },
        true,
      )
      const html = await VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(SSRApp),
      )
      expect(html).toMatchInlineSnapshot(
        `"<!--[--><button>inner</button><div><button>inner</button></div><!--]-->"`,
      )

      // hydration
      let resolveInner: any
      let resolveOuter: any
      const innerHydrates: (() => void)[] = []
      const Inner = defineVaporAsyncComponent({
        loader: () =>
          new Promise(r => {
            resolveInner = r
          }),
        hydrate(hydrate) {
          innerHydrates.push(hydrate)
        },
      })
      const Outer = defineVaporAsyncComponent({
        loader: () =>
          new Promise(r => {
            resolveOuter = r
          }),
        hydrate(hydrate) {
          hydrate()
        },
      })
      const App = compileVaporComponent(appCode, data, { Inner, Outer })

      const container = document.createElement('div')
      container.innerHTML = html
      document.body.appendChild(container)
      createVaporSSRApp(App).mount(container)
      const buttons = () => container.querySelectorAll('button')

      resolveInner(compileVaporComponent(innerCode, data))
      await new Promise(r => setTimeout(r))
      expect(innerHydrates.length).toBe(1)

      resolveOuter(compileVaporComponent(outerCode, data, { Inner }))
      await new Promise(r => setTimeout(r))
      // the nested Inner is created while its loader is already resolved;
      // it must still defer to its hydration strategy
      expect(innerHydrates.length).toBe(2)
      triggerEvent('click', buttons()[1])
      expect(data.value.spy).not.toHaveBeenCalled()

      innerHydrates[1]()
      await new Promise(r => setTimeout(r))
      triggerEvent('click', buttons()[1])
      expect(data.value.spy).toHaveBeenCalledTimes(1)

      innerHydrates[0]()
      await new Promise(r => setTimeout(r))
      triggerEvent('click', buttons()[0])
      expect(data.value.spy).toHaveBeenCalledTimes(2)
    })

    // a synchronous strategy on an already-resolved wrapper re-enters
    // hydration inside the enclosing pass
    test('synchronous hydrate strategy on an already-resolved async component', async () => {
      const data = ref({ spy: vi.fn() })
      const compCode = `<button @click="data.spy">hello</button>`
      const appCode = `<div><components.AsyncComp/></div><span>after</span>`

      const SSRAsync = defineAsyncComponent(() =>
        Promise.resolve(compileVaporComponent(compCode, data, undefined, true)),
      )
      const SSRApp = compileVaporComponent(
        appCode,
        data,
        { AsyncComp: SSRAsync },
        true,
      )
      const html = await VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(SSRApp),
      )
      expect(html).toMatchInlineSnapshot(
        `"<!--[--><div><button>hello</button></div><span>after</span><!--]-->"`,
      )

      const strategy = vi.fn((hydrate: () => void) => hydrate())
      const AsyncComp = defineVaporAsyncComponent({
        loader: () => Promise.resolve(compileVaporComponent(compCode, data)),
        hydrate: strategy,
      })
      // resolve before hydration starts
      await (AsyncComp as any).__asyncLoader()
      const App = compileVaporComponent(appCode, data, { AsyncComp })

      const container = document.createElement('div')
      container.innerHTML = html
      document.body.appendChild(container)
      createVaporSSRApp(App).mount(container)

      expect(strategy).toHaveBeenCalledTimes(1)
      // the wrapper's runtime anchor lands after the hydrated content and the
      // enclosing pass resumes at the trailing sibling
      expect(container.innerHTML).toBe(
        `<!--[--><div><button>hello</button><!--async component--></div><span>after</span><!--]-->`,
      )
      triggerEvent('click', container.querySelector('button')!)
      expect(data.value.spy).toHaveBeenCalledTimes(1)
    })

    test('template ref on a lazily hydrated async component', async () => {
      const data = ref({})
      const compCode = `<span>inner</span>`
      const appCode = `<components.AsyncComp ref="comp"/>`

      const SSRAsync = defineAsyncComponent(() =>
        Promise.resolve(compileVaporComponent(compCode, data, undefined, true)),
      )
      const html = await VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(
          compileVaporComponent(appCode, data, { AsyncComp: SSRAsync }, true),
        ),
      )

      let resolve: any
      let doHydrate: (() => void) | undefined
      const Comp = compileVaporComponent(compCode, data)
      const AsyncComp = defineVaporAsyncComponent({
        loader: () =>
          new Promise(r => {
            resolve = r
          }),
        hydrate(hydrate) {
          doHydrate = hydrate
        },
      })
      const App = compileVaporComponent(appCode, data, { AsyncComp })
      const container = document.createElement('div')
      container.innerHTML = html
      document.body.appendChild(container)
      const app = createVaporSSRApp(App)
      app.mount(container)
      const refs = (app._instance as any).refs

      expect(refs.comp).toBeFalsy()
      resolve(Comp)
      await new Promise(r => setTimeout(r))
      // resolved, but hydration is still deferred by the strategy
      expect(refs.comp).toBeFalsy()

      doHydrate!()
      await new Promise(r => setTimeout(r))
      expect(refs.comp).toBeTruthy()
      expect(refs.comp.type).toBe(Comp)
      // vapor props flow reactively, so the wrapper never needs the vdom-only
      // "patched before lazy hydration" update hook
      expect((app._instance as any).block.bu).toBeUndefined()
    })

    test('deferred async component stays unresolved for its consumers after a sibling resolved the loader', async () => {
      const data = ref({})
      const compCode = `<span>inner</span>`
      const appCode = `<components.AsyncComp ref="a"/><components.AsyncComp ref="b"/>`

      const SSRAsync = defineAsyncComponent(() =>
        Promise.resolve(compileVaporComponent(compCode, data, undefined, true)),
      )
      const html = await VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(
          compileVaporComponent(appCode, data, { AsyncComp: SSRAsync }, true),
        ),
      )

      let resolve: any
      const hydrates: (() => void)[] = []
      const Comp = compileVaporComponent(compCode, data)
      const AsyncComp = defineVaporAsyncComponent({
        loader: () =>
          new Promise(r => {
            resolve = r
          }),
        hydrate(hydrate) {
          hydrates.push(hydrate)
        },
      })
      const App = compileVaporComponent(appCode, data, { AsyncComp })
      const container = document.createElement('div')
      container.innerHTML = html
      document.body.appendChild(container)
      const app = createVaporSSRApp(App)
      app.mount(container)
      const refs = (app._instance as any).refs

      resolve(Comp)
      await new Promise(r => setTimeout(r))
      expect(hydrates.length).toBe(2)

      hydrates[0]()
      await new Promise(r => setTimeout(r))
      expect(refs.a.type).toBe(Comp)
      // b's loader is resolved but its own hydration has not run: no ref yet,
      // and never the raw SSR node
      expect(refs.b == null).toBe(true)

      hydrates[1]()
      await new Promise(r => setTimeout(r))
      expect(refs.b.type).toBe(Comp)
      expect(container.innerHTML).toBe(
        '<!--[--><span>inner</span><!--async component--><span>inner</span><!--async component--><!--]-->',
      )
    })

    test('async component without a strategy hydrates in place when created resolved', async () => {
      const data = ref({ spy: vi.fn() })
      const innerCode = `<button @click="data.spy">inner</button>`
      const outerCode = `<div><components.Inner/></div>`
      const appCode = `<components.Outer/><span>after</span>`

      const SSRInner = defineAsyncComponent(() =>
        Promise.resolve(
          compileVaporComponent(innerCode, data, undefined, true),
        ),
      )
      const SSROuter = defineAsyncComponent(() =>
        Promise.resolve(
          compileVaporComponent(outerCode, data, { Inner: SSRInner }, true),
        ),
      )
      const html = await VueServerRenderer.renderToString(
        runtimeDom.createSSRApp(
          compileVaporComponent(appCode, data, { Outer: SSROuter }, true),
        ),
      )

      const InnerComp = compileVaporComponent(innerCode, data)
      // no strategy: resolved before the deferred Outer creates it
      const Inner = defineVaporAsyncComponent(() => Promise.resolve(InnerComp))
      await (Inner as any).__asyncLoader()
      let doHydrate: (() => void) | undefined
      const Outer = defineVaporAsyncComponent({
        loader: () =>
          Promise.resolve(compileVaporComponent(outerCode, data, { Inner })),
        hydrate(hydrate) {
          doHydrate = hydrate
        },
      })
      const App = compileVaporComponent(appCode, data, { Outer })
      const container = document.createElement('div')
      container.innerHTML = html
      document.body.appendChild(container)
      createVaporSSRApp(App).mount(container)
      await new Promise(r => setTimeout(r))

      triggerEvent('click', container.querySelector('button')!)
      expect(data.value.spy).not.toHaveBeenCalled()

      doHydrate!()
      await new Promise(r => setTimeout(r))
      triggerEvent('click', container.querySelector('button')!)
      expect(data.value.spy).toHaveBeenCalledTimes(1)
      expect(container.innerHTML).toBe(
        '<!--[--><div><button>inner</button><!--async component--></div><!--async component--><span>after</span><!--]-->',
      )
    })
  })
})
