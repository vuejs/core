import { defineVaporComponent } from '../../src'
import {
  defineComponent,
  h,
  nextTick,
  ref,
  withAsyncContext,
} from '@vue/runtime-dom'
import {
  VueServerRenderer,
  compileToVaporRender,
  runtimeDom,
  runtimeVapor,
} from '../_utils'
import { compileVaporComponent, setupHydrationTest } from './_helpers'

setupHydrationTest()

// Async setup under VDOM Suspense: the SSR range stays pending until setup
// settles, then the render hydrates it in its own pass.
describe('Vapor Mode hydration: async setup', () => {
  const deferred = () => {
    let resolve!: () => void
    let reject!: () => void
    const promise = new Promise<void>((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }

  const ssr = (code: string, data = ref({}), components?: any) =>
    compileVaporComponent(code, data, components, true)

  async function hydrateAsync(
    ServerChild: any,
    ClientChild: any,
    extra: (server: boolean) => any[] = () => [],
  ) {
    const App = (server: boolean) =>
      defineComponent({
        setup: () => () =>
          h(runtimeDom.Suspense, null, {
            default: () =>
              h('div', [
                h(server ? ServerChild : ClientChild),
                ...extra(server),
              ]),
          }),
      })
    const html = await VueServerRenderer.renderToString(
      runtimeDom.createSSRApp(App(true)),
    )
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)
    const app = runtimeDom.createSSRApp(App(false))
    const errorHandler = vi.fn()
    app.config.errorHandler = errorHandler
    app.use(runtimeVapor.vaporInteropPlugin)
    app.mount(container)
    // let the setup promise settle and Suspense resolve
    const settle = async () => {
      await new Promise(r => setTimeout(r))
      await nextTick()
      expect(errorHandler).not.toHaveBeenCalled()
      expect(`Hydration node mismatch`).not.toHaveBeenWarned()
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()
    }
    return { html, container, settle }
  }

  const asyncDivCode = `<script vapor>
    const data = _data
    await data.value.wait
  </script><template><div>x</div></template>`

  // the shape dev-mode SFC output has: bindings + separate render()
  test('withAsyncContext with a separate render() hydrates the pending range', async () => {
    const wait = deferred()
    const ClientChild = defineVaporComponent({
      async setup() {
        let __temp: any, __restore: any
        ;(([__temp, __restore] = withAsyncContext(() => wait.promise)),
          await __temp,
          __restore())
        return { msg: ref('x') }
      },
      render: compileToVaporRender('<div>{{ msg }}</div>', {
        bindingMetadata: { msg: 'setup-ref' as any },
      }),
    })
    const { container, settle } = await hydrateAsync(
      ssr(asyncDivCode, ref({ wait: Promise.resolve() })),
      ClientChild,
    )
    wait.resolve()
    await settle()
    expect(container.innerHTML).toBe('<div><div>x</div></div>')
  })

  test.each([
    [
      'trailing v-for root',
      `<span>{{ data.msg }}</span><i v-for="x in data.list" :key="x">{{ x }}</i>`,
    ],
    [
      'trailing multi-root child',
      `<span>{{ data.msg }}</span><components.Multi />`,
    ],
  ])('multi-root async setup keeps its hydrated range (%s)', async (_, tpl) => {
    const wait = deferred()
    const serverData = ref({
      wait: Promise.resolve(),
      msg: 'one',
      list: ['a', 'b'],
    })
    const clientData = ref({ ...serverData.value, wait: wait.promise })
    const multiCode = `<em>a</em><em>b</em>`
    const code = `<script vapor>
      const data = _data
      const components = _components
      await data.value.wait
    </script><template>${tpl}</template>`
    const { html, container, settle } = await hydrateAsync(
      ssr(code, serverData, { Multi: ssr(multiCode, serverData) }),
      compileVaporComponent(code, clientData, {
        Multi: compileVaporComponent(multiCode, clientData),
      }),
      () => [h('u', 'after')],
    )
    wait.resolve()
    await settle()
    expect(container.innerHTML).toBe(html)
  })

  // A flush queued between the setup continuation and its resolve must run
  // as a client update, whatever microtask it lands on.
  test.each([0, 1, 2, 3])(
    'scheduler flush around the setup continuation runs outside hydration (hops=%i)',
    async hops => {
      const wait = deferred()
      const serverData = ref({ wait: Promise.resolve(), show: false })
      const clientData = ref({ wait: wait.promise, show: false })
      const asyncCode = `<script vapor>
        const data = _data
        await data.value.wait
      </script><template><span>async</span></template>`
      const togglerCode = `<script vapor>
        const data = _data
      </script><template><section><p v-if="data.show">shown</p></section></template>`
      const ServerToggler = ssr(togglerCode, serverData)
      const ClientToggler = compileVaporComponent(togglerCode, clientData)
      const { container, settle } = await hydrateAsync(
        ssr(asyncCode, serverData),
        compileVaporComponent(asyncCode, clientData),
        server => [h(server ? ServerToggler : ClientToggler)],
      )
      wait.resolve()
      for (let i = 0; i < hops; i++) await Promise.resolve()
      clientData.value.show = true
      await settle()
      expect(container.innerHTML).toBe(
        '<div><span>async</span><section><p>shown</p><!----></section></div>',
      )
    },
  )

  // coverage guard: the rejection path of withAsyncContext
  test('rejected await caught in setup still hydrates', async () => {
    const wait = deferred()
    const code = `<script vapor>
      const data = _data
      try { await data.value.wait } catch (e) {}
    </script><template><div>x</div></template>`
    const { container, settle } = await hydrateAsync(
      ssr(code, ref({ wait: Promise.resolve() })),
      compileVaporComponent(code, ref({ wait: wait.promise })),
    )
    wait.reject()
    await settle()
    expect(container.innerHTML).toBe('<div><div>x</div></div>')
  })
})
