// @vitest-environment jsdom

import { nextTick, shallowRef } from '@vue/runtime-dom'
import { createVaporApp } from '../src'
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
})
