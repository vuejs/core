import {
  VaporKeepAlive,
  createComponent,
  createIf,
  createVaporApp,
  createVaporSSRApp,
  defineVaporAsyncComponent,
  defineVaporComponent,
  template,
  vaporInteropPlugin,
} from '../src'
import {
  Suspense,
  createApp,
  defineAsyncComponent,
  defineComponent,
  h,
  nextTick,
  ref,
  setDevtoolsHook,
} from '@vue/runtime-dom'
import { VueServerRenderer, runtimeDom } from './_utils'
import { compileVaporComponent } from './hydration/_helpers'

function installHook(): string[] {
  const calls: string[] = []
  const hook = {
    enabled: true,
    emit(event: string, ...payload: any[]) {
      if (event === 'component:added' || event === 'component:removed') {
        calls.push(`${event.slice(10)} ${payload[3].type.name}`)
      }
    },
    cleanupBuffer: () => false,
  }
  // createVaporApp re-reads the global hook, as real devtools installs it there
  vi.stubGlobal('__VUE_DEVTOOLS_GLOBAL_HOOK__', hook)
  setDevtoolsHook(hook as any, {})
  return calls
}

const Child = defineVaporComponent({
  name: 'Child',
  setup: () => template('<span>child</span>')(),
})

describe('vapor devtools component hooks', () => {
  let host: HTMLElement
  beforeEach(() => {
    host = document.createElement('div')
    document.body.append(host)
  })
  afterEach(() => {
    host.remove()
    vi.unstubAllGlobals()
    setDevtoolsHook(undefined as any, {})
  })

  test('emits added / removed for vapor components', async () => {
    const calls = installHook()
    const show = ref(true)
    const Root = defineVaporComponent({
      name: 'Root',
      setup: () =>
        createIf(
          () => show.value,
          () => createComponent(Child),
        ),
    })
    const app = createVaporApp(Root)
    app.mount(host)
    expect(calls).toEqual(['added Child', 'added Root'])

    calls.length = 0
    show.value = false
    await nextTick()
    expect(calls).toEqual(['removed Child'])

    calls.length = 0
    show.value = true
    await nextTick()
    app.unmount()
    expect(calls).toEqual(['added Child', 'removed Child', 'removed Root'])
  })

  test('emits once for vapor components in a vdom app', () => {
    const calls = installHook()
    const app = createApp(
      defineComponent({ name: 'Root', render: () => h(Child as any) }),
    )
    app.use(vaporInteropPlugin)
    app.mount(host)
    app.unmount()
    expect(calls).toEqual([
      'added Child',
      'added Root',
      'removed Child',
      'removed Root',
    ])
  })

  test('reports kept-alive components only when the cache is dropped', async () => {
    const calls = installHook()
    const show = ref(true)
    const Root = defineVaporComponent({
      name: 'Root',
      setup: () =>
        createComponent(VaporKeepAlive, null, {
          default: () =>
            createIf(
              () => show.value,
              () => createComponent(Child),
            ),
        }),
    })
    const app = createVaporApp(Root)
    app.mount(host)

    show.value = false
    await nextTick()
    expect(calls).not.toContain('removed Child')

    app.unmount()
    expect(calls).toContain('removed Child')
  })

  test('does not report async setup unmounted before it resolves', () => {
    const calls = installHook()
    const Pending = defineVaporComponent({
      name: 'Pending',
      async setup() {
        await new Promise(() => {})
        return template('<p></p>')()
      },
    })
    const app = createApp(
      defineComponent({
        name: 'Root',
        render: () => h(Suspense, null, { default: () => h(Pending as any) }),
      }),
    )
    app.use(vaporInteropPlugin)
    app.mount(host)
    app.unmount()
    expect(calls).toEqual(['added Root', 'removed Root'])
  })

  test('reports hydrated async components in pairs', async () => {
    const SSRApp = compileVaporComponent(
      `<components.Async/>`,
      undefined,
      {
        Async: defineAsyncComponent(() =>
          Promise.resolve(
            compileVaporComponent(`<p>async</p>`, undefined, undefined, true),
          ),
        ),
      },
      true,
    )
    host.innerHTML = await VueServerRenderer.renderToString(
      runtimeDom.createSSRApp(SSRApp),
    )

    const calls = installHook()
    const Inner = defineVaporComponent({
      name: 'Inner',
      setup: () => template('<p>async</p>')(),
    })
    const Async = defineVaporAsyncComponent(() => Promise.resolve(Inner))
    const App = defineVaporComponent({
      name: 'App',
      setup: () => createComponent(Async),
    })
    const app = createVaporSSRApp(App)
    app.mount(host)
    await new Promise(r => setTimeout(r))
    app.unmount()

    const added = calls.filter(c => c.startsWith('added'))
    const removed = calls.filter(c => c.startsWith('removed'))
    expect(added).toContain('added Inner')
    expect(removed.map(c => c.replace('removed', 'added')).sort()).toEqual(
      added.sort(),
    )
  })
})
