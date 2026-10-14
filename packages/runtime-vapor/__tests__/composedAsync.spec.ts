import {
  computed,
  createApp,
  createSSRApp,
  nextTick,
  optimistic,
  ref,
  shallowRef,
} from '@vue/runtime-dom'
import { createVaporApp, createVaporSSRApp, vaporInteropPlugin } from '../src'
import { VueServerRenderer, compile } from './_utils'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

async function flush() {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
    await nextTick()
  }
}

describe.each([
  [false, false],
  [false, true],
  [true, false],
  [true, true],
])('composed async (app vapor=%s, child vapor=%s)', (vapor, childVapor) => {
  function mount(data: any, template = '<p>{{ heading }}</p>') {
    const Child = compile(
      `<script setup>
      import { computed } from 'vue'
      const { user, count, items, visible } = _data.value
      const heading = computed(() => 'Hello ' + user.value)
    </script><template>${template}</template>`,
      data,
      {},
      { vapor: childVapor },
    )
    const App = compile(
      `<script setup>
      const Child = _components.Child
      const { pending, resolved, timeout } = _data.value
    </script><template><Suspense :timeout="timeout" @pending="pending" @resolve="resolved">
      <Child />
      <template #fallback><span>loading</span></template>
    </Suspense></template>`,
      data,
      { Child },
      { vapor },
    )
    const host = document.createElement('div')
    const app = (vapor ? createVaporApp : createApp)(App)
    const errorHandler = vi.fn()
    app.config.errorHandler = errorHandler
    app.use(vaporInteropPlugin).mount(host)
    return { app, host, errorHandler }
  }

  test('shows fallback initially, holds refreshes, and ignores stale requests', async () => {
    const id = ref(0)
    const requests = [
      deferred<string>(),
      deferred<string>(),
      deferred<string>(),
    ]
    const user = computed(() => requests[id.value].promise)
    const pending = vi.fn()
    const resolved = vi.fn()
    const { app, host } = mount(shallowRef({ user, pending, resolved }))
    expect(host.textContent).toBe('loading')
    requests[0].resolve('one')
    await flush()
    expect(host.textContent).toBe('Hello one')
    expect(pending).toHaveBeenCalledTimes(1)
    expect(resolved).toHaveBeenCalledTimes(1)
    id.value = 1
    await nextTick()
    expect(host.textContent).toBe('Hello one')
    expect(pending).toHaveBeenCalledTimes(2)
    id.value = 2
    await nextTick()
    requests[2].resolve('three')
    await flush()
    expect(host.textContent).toBe('Hello three')
    requests[1].resolve('obsolete')
    await flush()
    expect(host.textContent).toBe('Hello three')
    expect(resolved).toHaveBeenCalledTimes(2)
    app.unmount()
  })

  test('does not publish synchronous writes ahead of a pending read', async () => {
    const id = ref(0)
    const requests = [deferred<string>(), deferred<string>()]
    const user = computed(() => requests[id.value].promise)
    const count = ref(0)
    const { app, host } = mount(
      shallowRef({ user, count }),
      '<div><i :title="count">{{ count }}</i><b>{{ heading }}</b></div>',
    )
    requests[0].resolve('one')
    await flush()
    expect(host.textContent).toBe('0Hello one')
    count.value++
    id.value++
    await nextTick()
    expect(host.textContent).toBe('0Hello one')
    expect(host.querySelector('i')!.title).toBe('0')
    requests[1].resolve('two')
    await flush()
    expect(host.textContent).toBe('1Hello two')
    expect(host.querySelector('i')!.title).toBe('1')
    app.unmount()
  })

  test('retains committed content on rejection and can recover', async () => {
    const id = ref(0)
    const requests = [
      deferred<string>(),
      deferred<string>(),
      deferred<string>(),
    ]
    const user = computed(() => requests[id.value].promise)
    const { app, host, errorHandler } = mount(shallowRef({ user }))
    requests[0].resolve('one')
    await flush()
    id.value++
    await nextTick()
    const error = new Error('request failed')
    requests[1].reject(error)
    await flush()
    expect(host.textContent).toBe('Hello one')
    expect(errorHandler).toHaveBeenCalledTimes(1)
    expect(errorHandler.mock.calls[0][0]).toBe(error)
    id.value++
    await nextTick()
    requests[2].resolve('recovered')
    await flush()
    expect(host.textContent).toBe('Hello recovered')
    app.unmount()
  })

  test('holds list and conditional updates until the branch is ready', async () => {
    const id = ref(0)
    const requests = [deferred<string>(), deferred<string>()]
    const user = computed(() => requests[id.value].promise)
    const items = ref(['a'])
    const visible = ref(true)
    const { app, host } = mount(
      shallowRef({ user, items, visible }),
      '<div><i v-if="visible">visible</i><b v-for="item in items" :key="item">{{ item }}</b><em>{{ heading }}</em></div>',
    )
    requests[0].resolve('one')
    await flush()
    expect(host.textContent).toBe('visibleaHello one')
    visible.value = false
    items.value = ['b', 'c']
    id.value++
    await nextTick()
    expect(host.textContent).toBe('visibleaHello one')
    requests[1].resolve('two')
    await flush()
    expect(host.textContent).toBe('bcHello two')
    app.unmount()
  })

  test('keeps an optimistic answer visible while the source refreshes', async () => {
    const id = ref(0)
    const requests = [deferred<string>(), deferred<string>()]
    const user = computed(() => requests[id.value].promise)
    const pending = vi.fn()
    const { app, host } = mount(shallowRef({ user, pending }))
    requests[0].resolve('one')
    await flush()
    const mutation = deferred<void>()
    const result = optimistic(user, {
      update: value => value + '!',
      run: () => mutation.promise,
    })
    await nextTick()
    expect(host.textContent).toBe('Hello one!')
    id.value++
    await nextTick()
    expect(host.textContent).toBe('Hello one!')
    expect(pending).toHaveBeenCalledTimes(1)
    requests[1].resolve('two')
    await flush()
    expect(host.textContent).toBe('Hello two!')
    const error = new Error('mutation failed')
    mutation.reject(error)
    await expect(result).rejects.toBe(error)
    await nextTick()
    expect(host.textContent).toBe('Hello two')
    expect(pending).toHaveBeenCalledTimes(1)
    app.unmount()
  })

  test('waits for sibling reads before revealing a refresh', async () => {
    const id = ref(0)
    const a = [deferred<string>(), deferred<string>()]
    const b = [deferred<string>(), deferred<string>()]
    const first = computed(() => a[id.value].promise)
    const second = computed(() => b[id.value].promise)
    const suffix = ref('')
    const updated = vi.fn(() => host.textContent)
    const data = shallowRef({ first, second, suffix, updated })
    const First = compile(
      `<script setup>import { onUpdated } from 'vue'; const { first: value, suffix } = _data.value; onUpdated(_data.value.updated)</script><template><i>{{ value }}{{ suffix }}</i></template>`,
      data,
      {},
      { vapor: childVapor },
    )
    const Second = compile(
      `<script setup>const value = _data.value.second</script><template><b>{{ value }}</b></template>`,
      data,
      {},
      { vapor: childVapor },
    )
    const App = compile(
      `<script setup>const { First, Second } = _components</script><template><Suspense><div><First /><Second /></div><template #fallback>loading</template></Suspense></template>`,
      data,
      { First, Second },
      { vapor },
    )
    const host = document.createElement('div')
    const app = (vapor ? createVaporApp : createApp)(App).use(
      vaporInteropPlugin,
    )
    app.mount(host)
    a[0].resolve('a0')
    await flush()
    expect(host.textContent).toBe('loading')
    b[0].resolve('b0')
    await flush()
    expect(host.textContent).toBe('a0b0')
    expect(updated).not.toHaveBeenCalled()
    id.value++
    await nextTick()
    a[1].resolve('a1')
    await flush()
    expect(host.textContent).toBe('a0b0')
    expect(updated).not.toHaveBeenCalled()
    suffix.value = '!'
    await nextTick()
    expect(host.textContent).toBe('a0b0')
    expect(updated).not.toHaveBeenCalled()
    b[1].resolve('b1')
    await flush()
    expect(host.textContent).toBe('a1!b1')
    expect(updated).toHaveBeenCalledTimes(1)
    expect(updated).toHaveReturnedWith('a1!b1')
    app.unmount()
  })

  test('captures computed props in the default slot of the nearest boundary', async () => {
    const id = ref(0)
    const requests = [deferred<string>(), deferred<string>()]
    const user = computed(() => requests[id.value].promise)
    const data = shallowRef({ user })
    const mounted = vi.fn()
    const Child = compile(
      `<script setup>
      import { onMounted } from 'vue'
      defineProps(['user'])
      onMounted(_data.value.mounted)
    </script><template><p>{{ user }}</p></template>`,
      shallowRef({ mounted }),
      {},
      { vapor: childVapor },
    )
    const App = compile(
      `<script setup>
      const Child = _components.Child
      const user = _data.value.user
    </script><template><Suspense><Child :user="user" /><template #fallback>loading</template></Suspense></template>`,
      data,
      { Child },
      { vapor },
    )
    const host = document.createElement('div')
    const app = (vapor ? createVaporApp : createApp)(App).use(
      vaporInteropPlugin,
    )
    app.mount(host)
    expect(host.textContent).toBe('loading')
    requests[0].resolve('one')
    await flush()
    expect(host.textContent).toBe('one')
    expect(mounted).toHaveBeenCalledTimes(1)
    id.value++
    await nextTick()
    expect(host.textContent).toBe('one')
    requests[1].resolve('two')
    await flush()
    expect(host.textContent).toBe('two')
    expect(mounted).toHaveBeenCalledTimes(1)
    app.unmount()
  })

  test('honors timeout while preserving the committed component for recovery', async () => {
    const id = ref(0)
    const requests = [
      deferred<string>(),
      deferred<string>(),
      deferred<string>(),
    ]
    const user = computed(() => requests[id.value].promise)
    const { app, host, errorHandler } = mount(shallowRef({ user, timeout: 0 }))
    requests[0].resolve('one')
    await flush()
    const node = host.querySelector('p')
    id.value++
    await nextTick()
    expect(host.textContent).toBe('loading')
    requests[1].resolve('two')
    await flush()
    expect(host.textContent).toBe('Hello two')
    expect(host.querySelector('p')).toBe(node)
    id.value++
    await nextTick()
    expect(host.textContent).toBe('loading')
    requests[2].reject(new Error('failed'))
    await flush()
    expect(host.textContent).toBe('Hello two')
    expect(host.querySelector('p')).toBe(node)
    expect(errorHandler).toHaveBeenCalledTimes(1)
    app.unmount()
  })

  test('replaces a pending promise prop without waiting for its obsolete request', async () => {
    const first = deferred<string>()
    const second = deferred<string>()
    const source = shallowRef(first.promise)
    const mounted = vi.fn()
    const beforeMount = vi.fn()
    const data = shallowRef({ source, mounted, beforeMount })
    const Child = compile(
      `<script setup>
      import { computed, onBeforeMount, onMounted } from 'vue'
      const props = defineProps(['source'])
      const value = computed(() => props.source)
      onBeforeMount(_data.value.beforeMount)
      onMounted(_data.value.mounted)
    </script><template><p>{{ value }}</p></template>`,
      data,
      {},
      { vapor: childVapor },
    )
    const App = compile(
      `<script setup>
      const Child = _components.Child
      const source = _data.value.source
    </script><template><Suspense><Child :source="source" /><template #fallback>loading</template></Suspense></template>`,
      data,
      { Child },
      { vapor },
    )
    const host = document.createElement('div')
    const app = (vapor ? createVaporApp : createApp)(App).use(
      vaporInteropPlugin,
    )
    app.mount(host)
    expect(host.textContent).toBe('loading')
    source.value = second.promise
    await nextTick()
    second.resolve('latest')
    await flush()
    expect(host.textContent).toBe('latest')
    first.resolve('obsolete')
    await flush()
    expect(host.textContent).toBe('latest')
    expect(beforeMount).toHaveBeenCalledTimes(1)
    expect(mounted).toHaveBeenCalledTimes(1)
    app.unmount()
  })

  test('keeps the initial fallback on rejection and ignores completion after unmount', async () => {
    const request = deferred<string>()
    const { app, host, errorHandler } = mount(
      shallowRef({ user: computed(() => request.promise) }),
    )
    request.reject(new Error('failed'))
    await flush()
    expect(host.textContent).toBe('loading')
    expect(errorHandler).toHaveBeenCalledTimes(1)
    app.unmount()
    expect(host.textContent).toBe('')

    const later = deferred<string>()
    const mounted = mount(shallowRef({ user: computed(() => later.promise) }))
    mounted.app.unmount()
    later.resolve('late')
    await flush()
    expect(mounted.host.textContent).toBe('')
  })

  test('applies state changes from beforeUpdate before updated observes the DOM', async () => {
    const id = ref(0)
    const requests = [deferred<string>(), deferred<string>()]
    const value = computed(() => requests[id.value].promise)
    const suffix = ref('')
    const beforeUpdate = () => {
      suffix.value = '!'
    }
    const updated = vi.fn(() => host.textContent)
    const data = shallowRef({ value, suffix, beforeUpdate, updated })
    const Child = compile(
      `<script setup>
      import { onBeforeUpdate, onUpdated } from 'vue'
      const { value, suffix, beforeUpdate, updated } = _data.value
      onBeforeUpdate(beforeUpdate)
      onUpdated(updated)
    </script><template><p>{{ value }}{{ suffix }}</p></template>`,
      data,
      {},
      { vapor: childVapor },
    )
    const App = compile(
      `<script setup>const Child = _components.Child</script><template><Suspense><Child /><template #fallback>loading</template></Suspense></template>`,
      data,
      { Child },
      { vapor },
    )
    const host = document.createElement('div')
    const app = (vapor ? createVaporApp : createApp)(App).use(
      vaporInteropPlugin,
    )
    app.mount(host)
    requests[0].resolve('one')
    await flush()
    expect(host.textContent).toBe('one')
    expect(updated).not.toHaveBeenCalled()
    id.value++
    await nextTick()
    requests[1].resolve('two')
    await flush()
    expect(host.textContent).toBe('two!')
    expect(updated).toHaveBeenCalledTimes(1)
    expect(updated).toHaveReturnedWith('two!')
    app.unmount()
  })

  test('completes out-in transitions when a refresh falls back', async () => {
    const id = ref(0)
    const requests = [
      deferred<string>(),
      deferred<string>(),
      deferred<string>(),
    ]
    const value = computed(() => requests[id.value].promise)
    let finishLeave!: () => void
    const leave = vi.fn((_el, done) => {
      finishLeave = done
    })
    const mounted = vi.fn()
    const data = shallowRef({ value, leave, mounted })
    const Child = compile(
      `<script setup>
      import { onMounted } from 'vue'
      const value = _data.value.value
      onMounted(_data.value.mounted)
    </script><template><p>{{ value }}</p></template>`,
      data,
      {},
      { vapor: childVapor },
    )
    const Boundary = compile(
      `<script setup>const Child = _components.Child; const leave = _data.value.leave</script>
    <template><Transition mode="out-in" :css="false" @leave="leave">
      <Suspense :timeout="0"><Child /><template #fallback><span>loading</span></template></Suspense>
    </Transition></template>`,
      data,
      { Child },
      { vapor: false },
    )
    const App = compile(
      `<script setup>const Boundary = _components.Boundary</script><template><Boundary /></template>`,
      data,
      { Boundary },
      { vapor },
    )
    const host = document.createElement('div')
    const app = (vapor ? createVaporApp : createApp)(App).use(
      vaporInteropPlugin,
    )
    app.mount(host)
    requests[0].resolve('one')
    await flush()
    finishLeave()
    await flush()
    expect(host.textContent).toBe('one')
    const node = host.querySelector('p')
    id.value++
    await nextTick()
    expect(leave).toHaveBeenCalledTimes(2)
    expect(host.textContent).toBe('one')
    finishLeave()
    await flush()
    expect(host.textContent).toBe('loading')
    requests[1].resolve('two')
    await flush()
    finishLeave()
    await flush()
    expect(host.textContent).toBe('two')
    expect(host.querySelector('p')).toBe(node)

    id.value++
    await nextTick()
    requests[2].resolve('three')
    await flush()
    finishLeave()
    await flush()
    expect(host.textContent).toBe('three')
    expect(host.querySelector('p')).toBe(node)
    expect(mounted).toHaveBeenCalledTimes(1)
    app.unmount()
  })
})

describe.each([false, true])(
  'async computed SSR and hydration (vapor=%s)',
  vapor => {
    test('awaits pending SSR reads and preserves server content during hydration', async () => {
      const sfc = `<script setup>
      import { computed } from 'vue'
      const user = computed(() => _data.value.promise)
    </script><template><p>{{ user }}</p></template>`
      const appSfc = `<script setup>const Child = _components.Child</script>
      <template><Suspense><Child /><template #fallback>loading</template></Suspense></template>`
      const serverData = shallowRef({ promise: Promise.resolve('server') })
      const serverChild = compile(sfc, serverData, {}, { vapor, ssr: true })
      const ServerApp = compile(
        appSfc,
        serverData,
        { Child: serverChild },
        { vapor, ssr: true },
      )
      const html = await VueServerRenderer.renderToString(
        createSSRApp(ServerApp),
      )
      expect(html).toBe(
        vapor ? '<!--[--><p>server</p><!--]-->' : '<p>server</p>',
      )
      const request = deferred<string>()
      const clientData = shallowRef(request)
      const Child = compile(sfc, clientData, {}, { vapor })
      const App = compile(appSfc, clientData, { Child }, { vapor })
      const host = document.createElement('div')
      host.innerHTML = html
      const node = host.firstChild
      const app = (vapor ? createVaporSSRApp : createSSRApp)(App).use(
        vaporInteropPlugin,
      )
      app.mount(host)
      expect(host.innerHTML).toBe(html)
      expect(host.firstChild).toBe(node)
      request.resolve('server')
      await flush()
      expect(host.innerHTML).toBe(html)
      expect(host.firstChild).toBe(node)
      app.unmount()
    })
  },
)
