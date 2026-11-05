// @vitest-environment jsdom

import { type Ref, nextTick, ref } from 'vue'
import { compile, makeRender } from '../_utils'
import { vaporInteropPlugin } from '../../src'

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
    const data = ref({ show: true, outer: true })
    const App = compile(
      `<template>
        <Transition :css="false">
          <template v-if="data.outer">
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
      `<template>
        <components.Wrapper><div v-if="data.show" id="a" /></components.Wrapper>
      </template>`,
      data,
      { Wrapper },
    )
    await expectBranchReleased(App, data)
  })

  async function expectBranchReleased(
    App: any,
    data: Ref<{ show: boolean }>,
    interop = false,
  ) {
    const { app, mount } = define(App).create()
    if (interop) app.use(vaporInteropPlugin)
    const { host } = mount()
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
  test('component child: instance + setup data released', async () => {
    const held: { deref(): object | undefined }[] = []
    const data = ref({
      show: true,
      hold: (...targets: object[]) => {
        // @ts-expect-error ES2021 API
        targets.forEach(t => held.push(new WeakRef(t)))
      },
    })
    const Child = compile(
      `<script setup vapor>
        import { ref } from 'vue'
        const big = ref({ payload: new Array(1000).fill(0) })
        const onClick = () => big.value.payload.length
        _data.value.hold(big.value, onClick)
      </script>
      <template>
        <div id="a" @click="onClick">{{ big.payload.length }}</div>
      </template>`,
      data,
    )
    const App = compile(
      `<template>
        <Transition :css="false">
          <components.Child v-if="data.show" />
        </Transition>
      </template>`,
      data,
      { Child },
    )
    const { app, host } = define(App).render()
    const removed = getElementRef(host)
    expect(held).toHaveLength(2)
    try {
      data.value.show = false
      await nextTick()
      await gc()
      expect(removed.deref()).toBeUndefined()
      expect(held.map(h => h.deref())).toEqual([undefined, undefined])
    } finally {
      app.unmount()
    }
  })

  test('in-out: a -> b -> nothing releases b', async () => {
    const data = ref({ s: 1 })
    const App = compile(
      `<template>
        <Transition mode="in-out" :css="false">
          <div v-if="data.s === 1" id="a" />
          <div v-else-if="data.s === 2" id="b" />
        </Transition>
      </template>`,
      data,
    )
    const { app, host } = define(App).render()
    const removedA = getElementRef(host)
    try {
      data.value.s = 2
      await nextTick()
      expect(host.firstElementChild!.id).toBe('b')
      const removedB = getElementRef(host)
      data.value.s = 3
      await nextTick()
      expect(host.firstElementChild).toBeNull()
      await gc()
      expect(removedA.deref()).toBeUndefined()
      expect(removedB.deref()).toBeUndefined()
    } finally {
      app.unmount()
    }
  })

  test('v-else holding only a false v-if releases a', async () => {
    const data = ref({ show: true, b: false })
    const App = compile(
      `<template>
        <Transition :css="false">
          <div v-if="data.show" id="a" />
          <template v-else>
            <div v-if="data.b" id="b" />
          </template>
        </Transition>
      </template>`,
      data,
    )
    await expectBranchReleased(App, data)
  })

  test('dynamic-slot Transition root: branch to nothing releases a', async () => {
    const data = ref({ show: true, dyn: true })
    const App = compile(
      `<template>
        <Transition :css="false">
          <template v-if="data.dyn" #default>
            <div v-if="data.show" id="a" />
          </template>
        </Transition>
      </template>`,
      data,
    )
    await expectBranchReleased(App, data)
  })

  test('interop root: a vdom child that left to nothing is released', async () => {
    const data = ref({ show: true })
    const Child = compile(
      `<script setup>
        const data = _data
      </script>
      <template>
        <div id="a">{{ data.show }}</div>
      </template>`,
      data,
      {},
      { vapor: false },
    )
    const App = compile(
      `<template>
        <Transition :css="false">
          <components.Child v-if="data.show" />
        </Transition>
      </template>`,
      data,
      { Child },
    )
    await expectBranchReleased(App, data, true)
  })
})

describe.skipIf(!global.gc)('TransitionGroup/gc', () => {
  // the rows' elements, walked synchronously: a querySelectorAll result would
  // keep them reachable
  function rowRefs(host: Element) {
    const refs: { deref(): Element | undefined }[] = []
    for (let el = host.firstElementChild; el; el = el.nextElementSibling) {
      // @ts-expect-error ES2021 API
      refs.push(new WeakRef(el))
    }
    return refs
  }

  test('removed rows rendered as fragments release their elements', async () => {
    const data = ref({ list: [1, 2, 3], show: true })
    const Row = compile(
      `<template>
        <div v-if="data.show" class="row">row</div>
      </template>`,
      data,
    )
    const App = compile(
      `<template>
        <TransitionGroup :css="false">
          <components.Row v-for="i in data.list" :key="i" />
        </TransitionGroup>
      </template>`,
      data,
      { Row },
    )
    const { app, host } = define(App).render()
    const refs = rowRefs(host)
    expect(refs).toHaveLength(3)
    try {
      data.value.list = []
      await nextTick()
      await gc()
      expect(refs.map(r => r.deref())).toEqual([
        undefined,
        undefined,
        undefined,
      ])
    } finally {
      app.unmount()
    }
  })

  test('vapor slot rows under a vdom TransitionGroup wrapper are released', async () => {
    const data = ref({ list: [1, 2], show: true })
    const Row = compile(
      `<template>
        <div v-if="data.show" class="row">row</div>
      </template>`,
      data,
    )
    const Wrapper = compile(
      `<script setup>
        const data = _data
      </script>
      <template>
        <TransitionGroup :css="false"><slot /></TransitionGroup>
      </template>`,
      data,
      {},
      { vapor: false },
    )
    const App = compile(
      `<template>
        <components.Wrapper>
          <components.Row v-for="i in data.list" :key="i" />
        </components.Wrapper>
      </template>`,
      data,
      { Row, Wrapper },
    )
    const { app, mount } = define(App).create()
    app.use(vaporInteropPlugin)
    const { host } = mount()
    const refs = rowRefs(host)
    expect(refs).toHaveLength(2)
    try {
      data.value.list = []
      await nextTick()
      expect(host.children).toHaveLength(0)
      await gc()
      await gc()
      expect(refs.map(r => r.deref())).toEqual([undefined, undefined])
    } finally {
      app.unmount()
    }
  })
})
