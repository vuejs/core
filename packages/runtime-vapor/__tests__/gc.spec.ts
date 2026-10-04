// @vitest-environment jsdom

import { createApp, nextTick, shallowRef } from '@vue/runtime-dom'
import { createVaporApp, vaporInteropPlugin } from '../src'
import { compile } from './_utils'

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
})
