// @vitest-environment jsdom

import { type Ref, nextTick, ref } from 'vue'
import { compile, makeRender } from '../_utils'

const define = makeRender()

const gc = () =>
  new Promise<void>(resolve => {
    setTimeout(() => {
      global.gc!()
      resolve()
    })
  })

// Keep the element access out of the async test's retained stack frame.
function getElementRef(host: Element) {
  // @ts-expect-error ES2021 API
  return new WeakRef(host.firstElementChild!)
}

describe.skipIf(!global.gc)('Transition/gc', () => {
  test('in-out: completed leaves release their elements while the app is mounted', async () => {
    const removed: { deref(): Element | undefined }[] = []
    const data = ref({
      key: 0,
      onLeave: (el: Element, done: () => void) => {
        // @ts-expect-error ES2021 API
        removed.push(new WeakRef(el))
        done()
      },
    })
    const App = compile(
      `<template>
        <Transition mode="in-out" :css="false" @leave="data.onLeave">
          <div :key="data.key" :id="'k' + data.key" />
        </Transition>
      </template>`,
      data,
    )
    const { app, host } = define(App).render()

    try {
      for (let key = 1; key <= 10; key++) {
        data.value.key = key
        await nextTick()
      }
      expect(removed).toHaveLength(10)
      expect(host.innerHTML).toBe('<div id="k10"></div><!--keyed-->')

      await gc()
      await gc()
      expect(removed.filter(element => element.deref())).toHaveLength(0)
      expect(host.innerHTML).toBe('<div id="k10"></div><!--keyed-->')
    } finally {
      app.unmount()
    }
  })

  test('in-out: early removal releases an element while the next enter is pending', async () => {
    const data = ref({
      show: true,
      // Leave enters pending without retaining their completion callbacks.
      onEnter: (_el: Element, _done: () => void) => {},
    })
    const App = compile(
      `<template>
        <Transition mode="in-out" :css="false" @enter="data.onEnter">
          <div v-if="data.show" id="a" />
          <div v-else id="b" />
        </Transition>
      </template>`,
      data,
    )
    const { app, host } = define(App).render()
    const removed = getElementRef(host)

    try {
      data.value.show = false
      await nextTick()
      data.value.show = true
      await nextTick()
      expect(host.innerHTML).toBe(
        '<div id="b"></div><div id="a"></div><!--if-->',
      )

      await gc()
      await gc()
      expect(removed.deref()).toBeUndefined()
      expect(host.innerHTML).toBe(
        '<div id="b"></div><div id="a"></div><!--if-->',
      )
    } finally {
      app.unmount()
    }
  })

  test.each([
    ['default', ''],
    ['out-in', 'mode="out-in"'],
    ['in-out', 'mode="in-out"'],
  ])(
    '%s: a branch that left to nothing releases its element',
    async (_, mode) => {
      const data = ref({ show: true })
      const App = compile(
        `<template>
        <Transition ${mode} :css="false">
          <div v-if="data.show" id="a" />
        </Transition>
      </template>`,
        data,
      )
      await expectBranchReleased(App, data)
    },
  )

  test('a nested branch that left to nothing releases its element', async () => {
    const data = ref({ show: true })
    const App = compile(
      `<template>
        <Transition :css="false">
          <template v-if="true">
            <div v-if="data.show" id="a" />
          </template>
        </Transition>
      </template>`,
      data,
    )
    await expectBranchReleased(App, data)
  })

  test('a slot branch that left to nothing releases its element', async () => {
    const data = ref({ show: true })
    const Wrapper = compile(
      `<template>
        <Transition :css="false"><slot /></Transition>
      </template>`,
      data,
    )
    const App = compile(
      `<script setup vapor>
        const data = _data
        const Wrapper = _components.Wrapper
      </script>
      <template>
        <Wrapper><div v-if="data.show" id="a" /></Wrapper>
      </template>`,
      data,
      { Wrapper },
    )
    await expectBranchReleased(App, data)
  })

  async function expectBranchReleased(App: any, data: Ref<{ show: boolean }>) {
    const { app, host } = define(App).render()
    const removed = getElementRef(host)

    try {
      data.value.show = false
      await nextTick()
      await gc()
      expect(removed.deref()).toBeUndefined()

      data.value.show = true
      await nextTick()
      expect(host.firstElementChild!.id).toBe('a')
    } finally {
      app.unmount()
    }
  }
})
