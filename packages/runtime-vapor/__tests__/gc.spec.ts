// @vitest-environment jsdom

import {
  type Ref,
  createApp,
  currentInstance,
  effectScope,
  nextTick,
  ref,
  shallowRef,
  watch,
  watchEffect,
} from '@vue/runtime-dom'
import {
  createVaporApp,
  defineVaporAsyncComponent,
  vaporInteropPlugin,
} from '../src'
import { compile } from './_utils'
import { setupHydrationTest, testHydration } from './hydration/_helpers'

describe.skipIf(!global.gc)('component props gc', () => {
  const gc = () => {
    return new Promise<void>(resolve => {
      setTimeout(() => {
        global.gc!()
        resolve()
      })
    })
  }

  test('releases the initial cached prop value after an update', async () => {
    const data = shallowRef({ y: { value: 0 } })
    // @ts-expect-error ES2021 API
    const initialValue = new WeakRef(data.value.y)
    const components = {
      Child: compile(
        `<script setup>
          import { watch } from 'vue'
          const props = defineProps({ y: Object })
          void props.y
          watch(() => props.y, () => {}, { flush: 'sync' })
        </script><template><p>{{ props.y.value }}</p></template>`,
        data,
      ),
    }
    const App = compile(
      `<template><components.Child :y="data.y" /></template>`,
      data,
      components,
    )
    const root = document.createElement('div')
    const app = createVaporApp(App)
    app.mount(root)
    try {
      expect(root.textContent).toBe('0')
      data.value = { y: { value: 1 } }
      await nextTick()
      expect(root.textContent).toBe('1')
      await gc()
      expect(initialValue.deref()).toBeUndefined()
    } finally {
      app.unmount()
    }
  })

  test('releases the initial prop value delivered by a vdom parent', async () => {
    const data = shallowRef({ y: { value: 0 } })
    // @ts-expect-error ES2021 API
    const initialValue = new WeakRef(data.value.y)
    const components = {
      Child: compile(
        `<script setup>
          const props = defineProps({ y: Object })
        </script><template><p>{{ props.y.value }}</p></template>`,
        data,
      ),
    }
    const App = compile(
      `<script setup>const data = _data; const components = _components;</script>
      <template><components.Child :y="data.y" /></template>`,
      data,
      components,
      { vapor: false },
    )
    const root = document.createElement('div')
    const app = createApp(App).use(vaporInteropPlugin)
    app.mount(root)
    try {
      expect(root.textContent).toBe('0')
      data.value = { y: { value: 1 } }
      await nextTick()
      expect(root.textContent).toBe('1')
      await gc()
      expect(initialValue.deref()).toBeUndefined()
    } finally {
      app.unmount()
    }
  })

  test('releases children in a removed branch containing v-model', async () => {
    let child: { deref(): unknown }
    const data = shallowRef({
      show: true,
      value: 'hello',
      capture: () => {
        // @ts-expect-error ES2021 API
        child = new WeakRef(currentInstance!)
      },
    })
    const components = {
      Child: compile(
        `<script setup>
          _data.value.capture()
        </script><template><p>child</p></template>`,
        data,
      ),
    }
    const App = compile(
      `<template><div>
        <template v-if="data.show">
          <input v-model="data.value" />
          <components.Child />
        </template>
      </div></template>`,
      data,
      components,
    )
    const root = document.createElement('div')
    const app = createVaporApp(App)
    app.mount(root)
    try {
      await nextTick()
      expect(root.textContent).toBe('child')
      data.value = { ...data.value, show: false }
      await nextTick()
      expect(root.querySelector('input, p')).toBeNull()
      await gc()
      expect(child!.deref()).toBeUndefined()
    } finally {
      app.unmount()
    }
  })
})

describe.skipIf(!global.gc)('hydration gc', () => {
  setupHydrationTest()

  const gc = () => {
    return new Promise<void>(resolve => {
      setTimeout(() => {
        global.gc!()
        resolve()
      })
    })
  }

  // WeakRef the node without querySelector: a selector match would be
  // retained by jsdom's selector cache.
  function refOf(root: ParentNode, id: string) {
    const walk = (n: ParentNode): Element | undefined => {
      for (let el = n.firstElementChild; el; el = el.nextElementSibling) {
        if (el.id === id) return el
        const found = walk(el)
        if (found) return found
      }
    }
    // @ts-expect-error ES2021 API
    return new WeakRef(walk(root)!) as { deref(): Element | undefined }
  }

  function refOfFirstChild(parent: Node) {
    // @ts-expect-error ES2021 API
    return new WeakRef(parent.firstChild!) as { deref(): Node | undefined }
  }

  test('releases a client-rendered v-if root that left', async () => {
    const data = ref({ show: true })
    const App = compile(
      `<template><div><div v-if="data.show" id="a">a</div></div></template>`,
      data,
    )
    const container = document.createElement('div')
    document.body.appendChild(container)
    const app = createVaporApp(App)
    app.mount(container)
    const removed = refOf(container, 'a')
    try {
      data.value.show = false
      await nextTick()
      await gc()
      await gc()
      expect(removed.deref()).toBeUndefined()
    } finally {
      app.unmount()
      container.remove()
    }
  })

  test('releases a hydrated v-if root that left', async () => {
    const data = ref({ show: true })
    const { container, app } = await testHydration(
      `<template><div><div v-if="data.show" id="a">a</div></div></template>`,
      {},
      data,
    )
    const removed = refOf(container, 'a')
    try {
      data.value.show = false
      await nextTick()
      await gc()
      await gc()
      expect(removed.deref()).toBeUndefined()
    } finally {
      app.unmount()
      container.remove()
    }
  })

  test('releases the open marker of a hydrated v-for that emptied', async () => {
    const data = ref({ list: [1, 2] })
    const { container, app } = await testHydration(
      `<template><div><span v-for="i in data.list">{{ i }}</span></div></template>`,
      {},
      data,
    )
    const removed = refOfFirstChild(container.firstChild!)
    try {
      data.value.list = []
      await nextTick()
      expect(container.innerHTML).toBe('<div><!--]--></div>')
      await gc()
      await gc()
      expect(removed.deref()).toBeUndefined()
    } finally {
      app.unmount()
      container.remove()
    }
  })

  test('releases a hydrated v-if root under <Transition appear> that left', async () => {
    const data = ref({ show: true })
    const { container, app } = await testHydration(
      `<template><div>
        <Transition appear :css="false">
          <div v-if="data.show" id="a">a</div>
        </Transition>
      </div></template>`,
      {},
      data,
    )
    const removed = refOf(container, 'a')
    try {
      data.value.show = false
      await nextTick()
      await gc()
      await gc()
      expect(removed.deref()).toBeUndefined()
    } finally {
      app.unmount()
      container.remove()
    }
  })
})

describe.skipIf(!global.gc)('directive gc', () => {
  const gc = () =>
    new Promise<void>(resolve => {
      setTimeout(() => {
        global.gc!()
        resolve()
      })
    })

  test('releases the root a disposed binding last resolved on a kept-alive chain', async () => {
    const data = ref({ root: true, view: 'inner', inner: true })
    const Inner = compile(
      `<template>
        <div v-if="data.inner">a</div>
        <p v-else>b</p>
      </template>`,
      data,
    )
    const Child = compile(
      `<script setup vapor>
        const data = _data
        const Inner = _components.Inner
      </script>
      <template>
        <KeepAlive>
          <Inner v-if="data.view === 'inner'" />
          <b v-else-if="data.view === 'b'">b</b>
          <i v-else>other</i>
        </KeepAlive>
      </template>`,
      data,
      { Inner },
    )
    const App = compile(
      `<script setup vapor>
        const data = _data
        const Child = _components.Child
        const vCustom = () => {}
      </script>
      <template>
        <KeepAlive>
          <Child v-if="data.root" v-custom />
          <span v-else>plain</span>
        </KeepAlive>
      </template>`,
      data,
      { Child },
    )
    const root = document.createElement('div')
    const app = createVaporApp(App)
    app.mount(root)
    try {
      // Inner leaves the root chain with the binding's hooks still on it
      data.value.view = 'i'
      await nextTick()
      expect(root.firstElementChild!.tagName).toBe('I')
      // @ts-expect-error ES2021 API
      const discarded = new WeakRef(root.firstElementChild!)
      // re-entering the outer branch disposes that binding
      data.value.root = false
      await nextTick()
      data.value.root = true
      await nextTick()
      // the root goes while Inner still holds those hooks in the cache
      data.value.view = 'b'
      await nextTick()
      expect(root.firstElementChild!.tagName).toBe('B')
      await gc()
      expect(discarded.deref()).toBeUndefined()
    } finally {
      app.unmount()
    }
  })

  // re-enters the outer branch after its v-show value was replaced and
  // returns the previous value if anything still holds it
  const disposedVShowValue = async (offChain: boolean) => {
    const data = ref<any>({
      root: true,
      cached: true,
      inner: true,
      shown: { label: 'previous' },
    })
    // @ts-expect-error ES2021 API
    const previous = new WeakRef(data.value.shown)
    const Inner = compile(
      `<template>
        <div v-if="data.inner">a</div>
        <p v-else>b</p>
      </template>`,
      data,
    )
    const Child = compile(
      `<script setup vapor>
        const data = _data
        const Inner = _components.Inner
      </script>
      <template>
        <KeepAlive>
          <Inner v-if="data.cached" />
          <i v-else>other</i>
        </KeepAlive>
      </template>`,
      data,
      { Inner },
    )
    const App = compile(
      `<script setup vapor>
        const data = _data
        const Child = _components.Child
      </script>
      <template>
        <KeepAlive>
          <Child v-if="data.root" v-show="data.shown" />
          <span v-else>plain</span>
        </KeepAlive>
      </template>`,
      data,
      { Child },
    )
    const root = document.createElement('div')
    const app = createVaporApp(App)
    app.mount(root)
    try {
      if (offChain) {
        // Inner leaves the root chain with the binding's hook still on it
        data.value.cached = false
        await nextTick()
      }
      data.value.root = false
      await nextTick()
      data.value.shown = null
      await nextTick()
      data.value.root = true
      await nextTick()
      await gc()
      return previous.deref()
    } finally {
      app.unmount()
    }
  }

  test('releases the value of a v-show binding disposed on a kept-alive chain', async () => {
    expect(await disposedVShowValue(false)).toBeUndefined()
  })

  test('releases the value of a v-show binding disposed while a nested KeepAlive holds its hook', async () => {
    expect(await disposedVShowValue(true)).toBeUndefined()
  })
})

describe.skipIf(!global.gc)('async component gc', () => {
  const gc = () =>
    new Promise<void>(resolve => {
      setTimeout(() => {
        global.gc!()
        resolve()
      })
    })

  const firstElementRef = (root: Element) =>
    // @ts-expect-error ES2021 API
    new WeakRef(root.firstElementChild!)

  // the root element of a child a v-if removed
  async function removedChildRoot(wrap: (comp: any) => any) {
    const data = ref({ show: true })
    const Inner = compile(
      `<template>
        <div>inner</div>
      </template>`,
      data,
    )
    const App = compile(
      `<template>
        <components.Child v-if="data.show" />
      </template>`,
      data,
      { Child: wrap(Inner) },
    )
    const root = document.createElement('div')
    const app = createVaporApp(App)
    app.mount(root)
    try {
      await new Promise(r => setTimeout(r))
      await nextTick()
      expect(root.textContent).toBe('inner')
      const el = firstElementRef(root)
      data.value.show = false
      await nextTick()
      expect(root.textContent).toBe('')
      await gc()
      return el.deref()
    } finally {
      app.unmount()
    }
  }

  // guard: passes before and after the fix below
  test('releases a removed component', async () => {
    expect(await removedChildRoot(comp => comp)).toBeUndefined()
  })

  // An owner of raw slots is registered once: this has to stay the first
  // async component without slots that this file mounts.
  test('releases the first removed async component that was given no slots', async () => {
    expect(
      await removedChildRoot(comp =>
        defineVaporAsyncComponent(() => Promise.resolve(comp)),
      ),
    ).toBeUndefined()
  })
})

describe.skipIf(!global.gc)('watcher owner gc', () => {
  const gc = () => {
    return new Promise<void>(resolve => {
      setTimeout(() => {
        global.gc!()
        resolve()
      })
    })
  }

  type CreateWatcher = (source: Ref<number>, cb: () => void) => void

  // removes the child whose setup created a watcher, then changes the source
  async function removedOwner(
    vapor: boolean,
    createWatcher: CreateWatcher,
    inOwnScope = false,
  ) {
    let child: { deref(): unknown }
    let calls = 0
    const source = ref(0)
    const scope = effectScope(true)
    const data = shallowRef({
      show: true,
      setup: () => {
        // @ts-expect-error ES2021 API
        child = new WeakRef(currentInstance!)
        const create = () => createWatcher(source, () => calls++)
        if (inOwnScope) create()
        else scope.run(create)
      },
    })
    const mode = vapor ? ' vapor' : ''
    const components = {
      Child: compile(
        `<script setup${mode}>
          _data.value.setup()
        </script>
        <template><p>child</p></template>`,
        data,
        {},
        { vapor },
      ),
    }
    const App = compile(
      `<script setup${mode}>
        const data = _data; const components = _components
      </script>
      <template><components.Child v-if="data.show" /></template>`,
      data,
      components,
      { vapor },
    )
    const root = document.createElement('div')
    const app = (vapor ? createVaporApp : createApp)(App)
    app.mount(root)
    try {
      await nextTick()
      expect(root.textContent).toBe('child')
      data.value = { ...data.value, show: false }
      await nextTick()
      expect(root.textContent).toBe('')
      await gc()
      const released = child!.deref() === undefined
      const before = calls
      source.value++
      await nextTick()
      return { released, fired: calls > before }
    } finally {
      app.unmount()
      scope.stop()
    }
  }

  describe.each([
    ['vdom', false],
    ['vapor', true],
  ] as const)('%s', (_, vapor) => {
    const flushes = ['pre', 'post', 'sync'] as const

    test.each(flushes)(
      'releases the removed owner of a watch in a longer-lived scope (flush: %s)',
      async flush => {
        expect(
          await removedOwner(vapor, (source, cb) => {
            watch(source, cb, { flush })
          }),
        ).toEqual({ released: true, fired: true })
      },
    )

    test.each(flushes)(
      'releases the removed owner of a watchEffect in a longer-lived scope (flush: %s)',
      async flush => {
        expect(
          await removedOwner(vapor, (source, cb) => {
            watchEffect(
              () => {
                void source.value
                cb()
              },
              { flush },
            )
          }),
        ).toEqual({ released: true, fired: true })
      },
    )

    // guard: passes before and after the fix
    test('releases the removed owner of a watch in its own scope', async () => {
      expect(
        await removedOwner(vapor, (source, cb) => void watch(source, cb), true),
      ).toEqual({ released: true, fired: false })
    })

    // guard: passes before the fix, which must not make the owner hold on to
    // the watchers it is released from
    test.each(['scope', 'handle'] as const)(
      'releases a watcher stopped by its %s while the owner stays mounted',
      async by => {
        let captured: { deref(): unknown }
        let stop: (() => void) | undefined
        const source = ref(0)
        const longLived = effectScope(true)
        const data = shallowRef({
          setup: () => {
            const scope = by === 'scope' ? effectScope(true) : longLived
            scope.run(() => {
              const value = {}
              // @ts-expect-error ES2021 API
              captured = new WeakRef(value)
              const handle = watch(source, () => void value)
              stop = by === 'scope' ? () => scope.stop() : handle
            })
          },
        })
        const App = compile(
          `<script setup${vapor ? ' vapor' : ''}>
            _data.value.setup()
          </script>
          <template><p>app</p></template>`,
          data,
          {},
          { vapor },
        )
        const root = document.createElement('div')
        const app = (vapor ? createVaporApp : createApp)(App)
        app.mount(root)
        try {
          await nextTick()
          stop!()
          stop = undefined
          await gc()
          expect(captured!.deref()).toBeUndefined()
          expect(root.textContent).toBe('app')
        } finally {
          app.unmount()
          longLived.stop()
        }
      },
    )
  })

  test('releases an owner that unmounted before its async setup resumed', async () => {
    let child: { deref(): unknown }
    let resolve!: () => void
    let calls = 0
    const source = ref(0)
    const scope = effectScope(true)
    const data = shallowRef({
      show: true,
      capture: () => {
        // @ts-expect-error ES2021 API
        child = new WeakRef(currentInstance!)
      },
      wait: () => new Promise<void>(r => (resolve = r)),
      create: () => scope.run(() => watch(source, () => calls++)),
    })
    const components = {
      Child: compile(
        `<script setup>
          _data.value.capture()
          await _data.value.wait()
          _data.value.create()
        </script>
        <template><p>child</p></template>`,
        data,
        {},
        { vapor: false },
      ),
    }
    const App = compile(
      `<script setup>
        const data = _data; const components = _components
      </script>
      <template>
        <Suspense>
          <components.Child v-if="data.show" />
        </Suspense>
      </template>`,
      data,
      components,
      { vapor: false },
    )
    const root = document.createElement('div')
    const app = createApp(App)
    app.mount(root)
    try {
      await nextTick()
      data.value = { ...data.value, show: false }
      await nextTick()
      resolve()
      await new Promise(r => setTimeout(r))
      await gc()
      const released = child!.deref() === undefined
      source.value++
      await nextTick()
      expect({ released, calls }).toEqual({ released: true, calls: 1 })
    } finally {
      app.unmount()
      scope.stop()
    }
  })
})
