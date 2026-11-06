import {
  VaporKeepAlive,
  VaporTeleport,
  createComponent,
  createIf,
  createSlot,
  createVaporApp,
  createVaporSSRApp,
  defineVaporAsyncComponent,
  defineVaporComponent,
  insert,
  template,
  vaporInteropPlugin,
} from '../src'
import type { VaporComponentInstance } from '../src/component'
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

describe('vapor devtools teleports', () => {
  let host: HTMLElement
  let target: HTMLElement
  beforeEach(() => {
    host = document.createElement('div')
    target = document.createElement('div')
    document.body.append(host, target)
  })
  afterEach(() => {
    host.remove()
    target.remove()
  })

  const teleport = () =>
    createComponent(
      VaporTeleport,
      { to: () => target },
      { default: () => template('<span>moved</span>')() },
    )

  test('tracks a teleport inserted into an element on its owner', async () => {
    const show = ref(true)
    const Root = defineVaporComponent({
      name: 'Root',
      setup() {
        const div = template('<div></div>')() as ParentNode
        insert(
          createIf(
            () => show.value,
            () => teleport(),
          ),
          div,
        )
        return div
      },
    })
    const app = createVaporApp(Root)
    app.mount(host)
    const root = app._instance as VaporComponentInstance
    const [frag] = [...root.teleports!]
    expect((frag.nodes as Node).parentNode).toBe(target)

    show.value = false
    await nextTick()
    expect(root.teleports!.size).toBe(0)

    show.value = true
    await nextTick()
    expect(root.teleports!.size).toBe(1)

    app.unmount()
    expect(root.teleports!.size).toBe(0)
  })

  test('keeps a teleport tracked while toggling disabled', async () => {
    const disabled = ref(false)
    const Root = defineVaporComponent({
      name: 'Root',
      setup() {
        const div = template('<div></div>')() as ParentNode
        insert(
          createComponent(
            VaporTeleport,
            { to: () => target, disabled: () => disabled.value },
            { default: () => template('<span>moved</span>')() },
          ),
          div,
        )
        return div
      },
    })
    const app = createVaporApp(Root)
    app.mount(host)
    const root = app._instance as VaporComponentInstance
    const [frag] = [...root.teleports!]

    disabled.value = true
    await nextTick()
    expect((frag.nodes as Node).parentNode).not.toBe(target)
    expect([...root.teleports!]).toEqual([frag])

    disabled.value = false
    await nextTick()
    expect((frag.nodes as Node).parentNode).toBe(target)
    expect([...root.teleports!]).toEqual([frag])
    app.unmount()
  })

  test('tracks a teleport in slot content on the slot outlet owner', () => {
    const Frame = defineVaporComponent({
      name: 'Frame',
      setup() {
        const section = template('<section></section>')() as ParentNode
        insert(createSlot('default'), section)
        return section
      },
    })
    const Root = defineVaporComponent({
      name: 'Root',
      setup: () => createComponent(Frame, null, { default: () => teleport() }),
    })
    const app = createVaporApp(Root)
    app.mount(host)
    const root = app._instance as VaporComponentInstance
    const frame = root.block as VaporComponentInstance
    // Same as VDOM, where teleported slot content's `__vueParentComponent` is Frame.
    expect(frame.teleports!.size).toBe(1)
    expect(root.teleports).toBeUndefined()
    app.unmount()
    expect(frame.teleports!.size).toBe(0)
  })

  test('tracks a hydrated teleport', async () => {
    target.id = 'tp-target'
    const code = `<div><teleport to="#tp-target"><span>moved</span></teleport></div>`
    const ctx: any = {}
    const html = await VueServerRenderer.renderToString(
      runtimeDom.createSSRApp(
        compileVaporComponent(code, undefined, undefined, true),
      ),
      ctx,
    )
    target.innerHTML = ctx.teleports['#tp-target']
    host.innerHTML = html

    const app = createVaporSSRApp(compileVaporComponent(code))
    app.mount(host)
    const root = app._instance as VaporComponentInstance
    const [frag] = [...root.teleports!]
    expect(frag.nodes).toBe(target.querySelector('span'))
    app.unmount()
    expect(root.teleports!.size).toBe(0)
  })

  test('tracks a teleport returned as the block', () => {
    const Root = defineVaporComponent({ name: 'Root', setup: () => teleport() })
    const app = createVaporApp(Root)
    app.mount(host)
    const root = app._instance as VaporComponentInstance
    expect([...root.teleports!]).toEqual([root.block])
    app.unmount()
    expect(root.teleports!.size).toBe(0)
  })
})
