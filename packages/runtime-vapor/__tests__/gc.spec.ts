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

const gc = () =>
  new Promise<void>(resolve => {
    setTimeout(() => {
      global.gc!()
      resolve()
    })
  })

describe.skipIf(!global.gc)('component props gc', () => {
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

describe.skipIf(!global.gc)('vdom host of vapor slot content gc', () => {
  test('releases content a pre-render hook changes and the render removes', async () => {
    const data = ref<any>({ n: 0, m: 0 })
    const Host = compile(
      `<script setup>
        import { onBeforeUpdate, ref } from 'vue'
        const props = defineProps(['data', 'n'])
        const show = ref(true)
        onBeforeUpdate(() => {
          props.data.m++
          show.value = false
        })
      </script><template><p v-if="show" :title="n"><slot /></p></template>`,
      ref(),
      {},
      { vapor: false },
    )
    const App = compile(
      `<template><components.Host :data="data" :n="data.n"><i>{{ data.m }}</i></components.Host></template>`,
      data,
      { Host },
    )
    const root = document.createElement('div')
    const app = createVaporApp(App).use(vaporInteropPlugin)
    app.mount(root)
    try {
      // @ts-expect-error ES2021 API
      const content = new WeakRef(root.querySelector('i')!)
      data.value.n++
      await nextTick()
      expect(root.querySelector('i')).toBeNull()
      await gc()
      expect(content.deref()).toBeUndefined()
    } finally {
      app.unmount()
    }
  })
})
