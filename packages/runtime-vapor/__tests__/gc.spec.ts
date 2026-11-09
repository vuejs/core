// @vitest-environment jsdom

import {
  createApp,
  currentInstance,
  nextTick,
  ref,
  shallowRef,
} from '@vue/runtime-dom'
import { createVaporApp, vaporInteropPlugin } from '../src'
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
    const data = ref({ root: true, cached: true, inner: true })
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
      data.value.cached = false
      await nextTick()
      expect(root.firstElementChild!.tagName).toBe('I')
      // @ts-expect-error ES2021 API
      const discarded = new WeakRef(root.firstElementChild!)
      // re-entering the outer branch disposes that binding
      data.value.root = false
      await nextTick()
      data.value.root = true
      await nextTick()
      data.value.cached = true
      await nextTick()
      await gc()
      expect(discarded.deref()).toBeUndefined()
    } finally {
      app.unmount()
    }
  })
})
