import {
  createApp,
  defineAsyncComponent,
  markRaw,
  nextTick,
  ref,
} from '@vue/runtime-dom'
import {
  createVaporApp,
  defineVaporAsyncComponent,
  vaporInteropPlugin,
} from '../src'
import { compile, renderParity } from './_utils'

// logs every lifecycle hook of its own as `${name}:${hook}`
const lifecycleChild = (name = 'own') => `<script setup>
import {
  onActivated,
  onBeforeMount,
  onBeforeUnmount,
  onBeforeUpdate,
  onDeactivated,
  onMounted,
  onUnmounted,
  onUpdated,
  ref,
} from 'vue'
const data = _data
defineProps(['count', 'unused'])
const inner = ref(0)
data.value.bump = () => inner.value++
const log = data.value.log
onBeforeMount(() => log.push('${name}:bm'))
onMounted(() => log.push('${name}:m'))
onBeforeUpdate(() => log.push('${name}:bu'))
onUpdated(() => log.push('${name}:u'))
onBeforeUnmount(() => log.push('${name}:bum'))
onUnmounted(() => log.push('${name}:um'))
onActivated(() => log.push('${name}:a'))
onDeactivated(() => log.push('${name}:da'))
</script>
<template>
  <div>{{ count }} {{ inner }}</div>
</template>`

const allHooks = `
  @vue:before-mount="data.bm"
  @vue:mounted="data.m"
  @vue:before-update="data.bu"
  @vue:updated="data.u"
  @vue:before-unmount="data.bum"
  @vue:unmounted="data.um"`

function makeData(extra?: (log: string[]) => Record<string, any>) {
  const log: string[] = markRaw([])
  const hook = (name: string) => () => {
    log.push(`vnode:${name}`)
  }
  return ref<any>({
    log,
    show: true,
    count: 0,
    unused: 0,
    bm: hook('bm'),
    m: hook('m'),
    bu: hook('bu'),
    u: hook('u'),
    bum: hook('bum'),
    um: hook('um'),
    ...(extra && extra(log)),
  })
}

type Logs = Record<string, string[]>

// the log of the mount and of every step, in each mode
async function run(
  srcs: Record<string, string>,
  steps: Record<string, (data: any) => void> = {},
  extra?: (log: string[]) => Record<string, any>,
): Promise<{ vdom: Logs; vapor: Logs }> {
  const logs: { vdom: Logs; vapor: Logs } = { vdom: {}, vapor: {} }
  await renderParity(
    srcs,
    () => makeData(extra),
    async (data, _root, mode) => {
      await nextTick()
      logs[mode].mount = data.value.log.splice(0)
      for (const name in steps) {
        steps[name](data.value)
        await nextTick()
        logs[mode][name] = data.value.log.splice(0)
      }
    },
  )
  return logs
}

const appScript = `<script setup>
const data = _data
const components = _components
</script>`

function mountApp(App: any, vapor: boolean) {
  const root = document.createElement('div')
  const app = vapor ? createVaporApp(App) : createApp(App)
  app.use(vaporInteropPlugin).mount(root)
  return { app, root }
}

describe('component: @vue:xxx lifecycle events', () => {
  test('mount, update and unmount', async () => {
    const logs = await run(
      {
        Child: lifecycleChild(),
        App: `<template>
          <components.Child
            v-if="data.show"
            :count="data.count"
            ${allHooks}
          />
        </template>`,
      },
      {
        prop: d => d.count++,
        self: d => d.bump(),
        unmount: d => (d.show = false),
      },
    )
    expect(logs.vdom).toEqual({
      mount: ['own:bm', 'vnode:bm', 'own:m', 'vnode:m'],
      prop: ['own:bu', 'vnode:bu', 'own:u', 'vnode:u'],
      self: ['own:bu', 'vnode:bu', 'own:u', 'vnode:u'],
      unmount: ['vnode:bum', 'own:bum', 'own:um', 'vnode:um'],
    })
    expect(logs.vapor).toEqual(logs.vdom)
  })

  // unlike vdom, a prop the child does not render updates nothing in vapor
  test('update hooks follow the own update hooks', async () => {
    const logs = await run(
      {
        Child: lifecycleChild(),
        App: `<template>
          <components.Child
            :unused="data.unused"
            ${allHooks}
          />
        </template>`,
      },
      { unused: d => d.unused++ },
    )
    expect(logs.vdom.unused).toEqual(['own:bu', 'vnode:bu', 'own:u', 'vnode:u'])
    expect(logs.vapor.unused).toEqual([])
  })

  test('static and v-bind object hooks', async () => {
    const logs = await run(
      {
        Child: lifecycleChild(),
        App: `<template>
          <components.Child
            @vue:mounted="data.m"
            v-bind="data.obj"
          />
        </template>`,
      },
      {},
      log => ({
        obj: markRaw({ onVnodeMounted: () => log.push('vnode:m:obj') }),
      }),
    )
    expect(logs.vdom.mount).toEqual([
      'own:bm',
      'own:m',
      'vnode:m',
      'vnode:m:obj',
    ])
    expect(logs.vapor).toEqual(logs.vdom)
  })

  test('hook added by a v-bind object after mount', async () => {
    const logs = await run(
      {
        Child: lifecycleChild(),
        App: `<template>
          <components.Child
            :count="data.count"
            v-bind="data.obj"
          />
        </template>`,
      },
      {
        add: d =>
          (d.obj = markRaw({ onVnodeUpdated: () => d.log.push('vnode:u') })),
        update: d => d.count++,
      },
      () => ({ obj: markRaw({}) }),
    )
    expect(logs.vdom.update).toEqual(['own:bu', 'own:u', 'vnode:u'])
    expect(logs.vapor.update).toEqual(logs.vdom.update)
  })

  test('KeepAlive', async () => {
    const logs = await run(
      {
        Child: lifecycleChild(),
        App: `<template>
          <KeepAlive>
            <components.Child
              v-if="data.show"
              ${allHooks}
            />
          </KeepAlive>
        </template>`,
      },
      {
        deactivate: d => (d.show = false),
        activate: d => (d.show = true),
      },
    )
    expect(logs.vdom).toEqual({
      mount: ['own:bm', 'vnode:bm', 'own:m', 'vnode:m', 'own:a'],
      deactivate: ['own:da', 'vnode:um'],
      activate: ['own:a', 'vnode:m'],
    })
    expect(logs.vapor).toEqual(logs.vdom)
  })

  test('switching a dynamic component', async () => {
    const logs = await run(
      {
        A: lifecycleChild('A'),
        B: lifecycleChild('B'),
        App: `<template>
          <component
            :is="data.show ? components.A : components.B"
            ${allHooks}
          />
        </template>`,
      },
      { switch: d => (d.show = false) },
    )
    expect(logs.vdom).toEqual({
      mount: ['A:bm', 'vnode:bm', 'A:m', 'vnode:m'],
      switch: [
        'vnode:bum',
        'A:bum',
        'B:bm',
        'vnode:bm',
        'A:um',
        'vnode:um',
        'B:m',
        'vnode:m',
      ],
    })
    expect(logs.vapor).toEqual(logs.vdom)
  })

  test('v-for', async () => {
    const logs = await run(
      {
        Row: `<script setup>
        defineProps(['id'])
        </script>
        <template>
          <div>{{ id }}</div>
        </template>`,
        App: `<template>
          <components.Row
            v-for="id in data.ids"
            :key="id"
            :id="id"
            @vue:mounted="data.log.push('vnode:m:' + id)"
            @vue:unmounted="data.log.push('vnode:um:' + id)"
          />
        </template>`,
      },
      {
        add: d => d.ids.push(3),
        remove: d => d.ids.shift(),
      },
      () => ({ ids: [1, 2] }),
    )
    expect(logs.vdom).toEqual({
      mount: ['vnode:m:1', 'vnode:m:2'],
      add: ['vnode:m:3'],
      remove: ['vnode:um:1'],
    })
    expect(logs.vapor).toEqual(logs.vdom)
  })

  // the own mounted hook is cancelled, the vnode one is not
  test('unmounted in the flush that mounted it', async () => {
    const logs = await run(
      {
        Child: `<script setup>
        import { onBeforeMount, onBeforeUnmount, onMounted, onUnmounted } from 'vue'
        const data = _data
        const log = data.value.log
        onBeforeMount(() => {
          log.push('own:bm')
          data.value.show = false
        })
        onMounted(() => log.push('own:m'))
        onBeforeUnmount(() => log.push('own:bum'))
        onUnmounted(() => log.push('own:um'))
        </script>
        <template>
          <div />
        </template>`,
        App: `<template>
          <components.Child
            v-if="data.show"
            ${allHooks}
          />
        </template>`,
      },
      { mount: d => (d.show = true) },
      () => ({ show: false }),
    )
    expect(logs.vdom.mount).toEqual([
      'own:bm',
      'vnode:bm',
      'vnode:bum',
      'own:bum',
      'vnode:m',
      'own:um',
      'vnode:um',
    ])
    expect(logs.vapor).toEqual(logs.vdom)
  })

  test('hooks are neither attrs nor props', async () => {
    const { vdom, vapor } = await renderParity(
      {
        Child: `<template>
          <div>{{ Object.keys($attrs).join() }}</div>
        </template>`,
        App: `<template>
          <components.Child
            id="a"
            @vue:mounted="data.m"
          />
        </template>`,
      },
      makeData,
      () => {},
    )
    expect(vdom.after).toBe('<div id="a">id</div>')
    expect(vapor.after).toBe(vdom.after)
  })

  // [wrapper, resolved component]
  test.each([
    ['vdom', 'vdom'],
    ['vapor', 'vapor'],
    ['vapor', 'vdom'],
  ])('async component: %s wrapper, %s inner', async (outer, inner) => {
    const data = makeData()
    const log: string[] = data.value.log
    const vapor = outer === 'vapor'
    const Inner = compile(
      lifecycleChild('inner'),
      data,
      {},
      { vapor: inner === 'vapor' },
    )
    const Loading = compile(lifecycleChild('loading'), data, {}, { vapor })
    let resolve!: (comp: any) => void
    const options = {
      loader: () => new Promise<any>(r => (resolve = r)),
      loadingComponent: Loading,
      delay: 0,
    }
    const Async = vapor
      ? defineVaporAsyncComponent(options)
      : defineAsyncComponent(options)
    const App = compile(
      `${appScript}
      <template>
        <components.Async
          v-if="data.show"
          @vue:before-mount="data.bm"
          @vue:mounted="data.m"
          @vue:before-unmount="data.bum"
          @vue:unmounted="data.um"
        />
      </template>`,
      data,
      { Async },
      { vapor },
    )
    const { app } = mountApp(App, vapor)

    // the wrapper fires nothing of its own
    await nextTick()
    expect(log.splice(0)).toEqual([
      'loading:bm',
      'vnode:bm',
      'loading:m',
      'vnode:m',
    ])

    resolve(Inner)
    await new Promise(r => setTimeout(r))
    await nextTick()
    expect(log.splice(0)).toEqual([
      'vnode:bum',
      'loading:bum',
      'inner:bm',
      'vnode:bm',
      'loading:um',
      'vnode:um',
      'inner:m',
      'vnode:m',
    ])

    data.value.show = false
    await nextTick()
    expect(log.splice(0)).toEqual([
      'vnode:bum',
      'inner:bum',
      'inner:um',
      'vnode:um',
    ])
    app.unmount()
  })

  test('KeepAlive: async component', async () => {
    const run = async (vapor: boolean) => {
      const data = makeData()
      const log: string[] = data.value.log
      const Inner = compile(lifecycleChild('inner'), data, {}, { vapor })
      let resolve!: (comp: any) => void
      const loader = () => new Promise<any>(r => (resolve = r))
      const Async = vapor
        ? defineVaporAsyncComponent(loader)
        : defineAsyncComponent(loader)
      const App = compile(
        `${appScript}
        <template>
          <KeepAlive>
            <components.Async
              v-if="data.show"
              @vue:before-mount="data.bm"
              @vue:mounted="data.m"
              @vue:before-unmount="data.bum"
              @vue:unmounted="data.um"
            />
          </KeepAlive>
        </template>`,
        data,
        { Async },
        { vapor },
      )
      const { app } = mountApp(App, vapor)
      const logs: Logs = {}
      resolve(Inner)
      await new Promise(r => setTimeout(r))
      await nextTick()
      logs.resolve = log.splice(0)
      data.value.show = false
      await nextTick()
      logs.deactivate = log.splice(0)
      data.value.show = true
      await nextTick()
      logs.activate = log.splice(0)
      app.unmount()
      return logs
    }

    const vdom = await run(false)
    expect(vdom).toEqual({
      resolve: ['inner:bm', 'vnode:bm', 'inner:m', 'vnode:m', 'inner:a'],
      deactivate: ['inner:da', 'vnode:um'],
      activate: ['inner:a', 'vnode:m'],
    })
    expect(await run(true)).toEqual(vdom)
  })

  test('hooks are called without arguments', async () => {
    const data = makeData()
    const spies: Record<string, any> = {}
    for (const name of ['bm', 'm', 'bu', 'u', 'bum', 'um']) {
      data.value[name] = spies[name] = vi.fn()
    }
    const Child = compile(
      `<script setup vapor>
      defineProps(['count'])
      </script>
      <template>
        <div>{{ count }}</div>
      </template>`,
      data,
    )
    const App = compile(
      `<template>
        <components.Child
          v-if="data.show"
          :count="data.count"
          ${allHooks}
        />
      </template>`,
      data,
      { Child },
    )
    const { app } = mountApp(App, true)
    await nextTick()
    data.value.count++
    await nextTick()
    data.value.show = false
    await nextTick()
    for (const name in spies) {
      expect(spies[name]).toHaveBeenCalledExactlyOnceWith()
    }
    app.unmount()
  })

  test('errors are handled as vnode hook errors of the parent', async () => {
    const err = new Error('mounted')
    const data = makeData(() => ({
      m: () => {
        throw err
      },
    }))
    const Child = compile(
      `<template>
        <div />
      </template>`,
      data,
    )
    const App = compile(
      `<template>
        <components.Child @vue:mounted="data.m" />
      </template>`,
      data,
      { Child },
    )
    const root = document.createElement('div')
    const app = createVaporApp(App)
    const handler = (app.config.errorHandler = vi.fn())
    app.mount(root)
    await nextTick()
    expect(handler).toHaveBeenCalledExactlyOnceWith(
      err,
      app._instance,
      'vnode hook',
    )
    app.unmount()
  })

  test('an async setup child mounts once it resolves', async () => {
    let resolve!: () => void
    const data = makeData(() => ({
      wait: markRaw(new Promise<void>(r => (resolve = r))),
    }))
    const log: string[] = data.value.log
    const Child = compile(
      `<script setup vapor>
      import { onBeforeMount, onMounted } from 'vue'
      const data = _data
      onBeforeMount(() => data.value.log.push('own:bm'))
      onMounted(() => data.value.log.push('own:m'))
      await data.value.wait
      </script>
      <template>
        <div>child</div>
      </template>`,
      data,
    )
    const Parent = compile(
      `<template>
        <components.Child
          @vue:before-mount="data.bm"
          @vue:mounted="data.m"
        />
      </template>`,
      data,
      { Child },
    )
    const App = compile(
      `${appScript}
      <template>
        <Suspense>
          <components.Parent />
        </Suspense>
      </template>`,
      data,
      { Parent },
      { vapor: false },
    )
    const { app, root } = mountApp(App, false)
    await nextTick()
    expect(log).toEqual([])

    resolve()
    await new Promise(r => setTimeout(r))
    await nextTick()
    expect(root.innerHTML).toContain('<div>child</div>')
    expect(log).toEqual(['own:bm', 'vnode:bm', 'own:m', 'vnode:m'])
    app.unmount()
  })

  test('a dynamic component resolved to an element ignores the hooks', async () => {
    const data = makeData()
    const App = compile(
      `<template>
        <component
          :is="'p'"
          @vue:mounted="data.m"
        />
      </template>`,
      data,
      {},
    )
    const { app, root } = mountApp(App, true)
    await nextTick()
    expect(root.innerHTML).toContain('<p></p>')
    expect(data.value.log).toEqual([])
    expect(
      '@vue:xxx per-element lifecycle events are not supported in Vapor mode ' +
        'and will be ignored on <p>.',
    ).toHaveBeenWarned()
    app.unmount()
  })

  // the vdom renderer owns the hooks of a vdom child: each fires exactly once
  test('vdom child', async () => {
    const data = makeData()
    const log: string[] = data.value.log
    const Child = compile(
      `<script setup>
      defineProps(['count'])
      </script>
      <template>
        <div>{{ count }}</div>
      </template>`,
      data,
      {},
      { vapor: false },
    )
    const App = compile(
      `<template>
        <components.Child
          v-if="data.show"
          :count="data.count"
          ${allHooks}
        />
      </template>`,
      data,
      { Child },
    )
    const { app } = mountApp(App, true)
    await nextTick()
    expect(log.splice(0)).toEqual(['vnode:bm', 'vnode:m'])
    data.value.count++
    await nextTick()
    expect(log.splice(0)).toEqual(['vnode:bu', 'vnode:u'])
    data.value.show = false
    await nextTick()
    expect(log.splice(0)).toEqual(['vnode:bum', 'vnode:um'])
    app.unmount()
  })
})
