import {
  createComponent,
  defineVaporComponent,
  setBlockKey,
  template,
} from '../../src'
import { resolveTransitionBlock } from '../../src/components/Transition'
import { nextTick, ref } from 'vue'
import { compile, makeRender } from '../_utils'

const define = makeRender()

function createAppearTestState(
  show: boolean,
  extraState: Record<string, any> = {},
) {
  const onBeforeAppear = vi.fn()
  const onAppear = vi.fn()
  const data = ref({
    show,
    ...extraState,
    onBeforeAppear,
    onAppear,
  })

  return {
    data,
    onBeforeAppear,
    onAppear,
  }
}

describe('Transition', () => {
  test('prefers explicit component key over uid when resolving child', () => {
    const Child = defineVaporComponent({
      setup() {
        return template(`<div>child</div>`)() as any
      },
    })

    let child: any
    define({
      setup() {
        child = createComponent(Child)
        setBlockKey(child, 'foo')
        return child
      },
    }).render()

    child.block.$key = undefined

    const resolved = resolveTransitionBlock(child)!
    expect(resolved.$key).toBe('foo')
  })

  test('falls back to component uid when explicit key is absent', () => {
    const Child = defineVaporComponent({
      setup() {
        return template(`<div>child</div>`)() as any
      },
    })

    let child: any
    define({
      setup() {
        child = createComponent(Child)
        return child
      },
    }).render()

    child.block.$key = undefined

    const resolved = resolveTransitionBlock(child)!
    expect(resolved.$key).toBe(child.uid)
  })

  test('preserves falsy explicit component key when resolving child', () => {
    const Child = defineVaporComponent({
      setup() {
        return template(`<div>child</div>`)() as any
      },
    })

    let child: any
    define({
      setup() {
        child = createComponent(Child)
        setBlockKey(child, 0)
        return child
      },
    }).render()

    child.block.$key = undefined

    const resolved = resolveTransitionBlock(child)!
    expect(resolved.$key).toBe(0)
  })

  test('treats null component key as absent when resolving child', () => {
    const Child = defineVaporComponent({
      setup() {
        return template(`<div>child</div>`)() as any
      },
    })

    let child: any
    define({
      setup() {
        child = createComponent(Child)
        setBlockKey(child, null)
        return child
      },
    }).render()

    child.block.$key = null

    const resolved = resolveTransitionBlock(child)!
    expect(resolved.$key).toBe(child.uid)
  })

  test('allows empty transition content', async () => {
    const App = compile(`<template><Transition /></template>`, ref({}))
    const { host } = define(App as any).render()

    await nextTick()

    expect(host.innerHTML).toBe('')
  })

  test('direct child with initial hidden v-show should not trigger appear hooks', async () => {
    const { data, onBeforeAppear, onAppear } = createAppearTestState(false)
    const App = compile(
      `<template>
        <Transition
          appear
          @before-appear="data.onBeforeAppear"
          @appear="data.onAppear"
        >
          <div v-show="data.show">foo</div>
        </Transition>
      </template>`,
      data,
    )
    const { host } = define(App as any).render()

    await nextTick()

    expect(host.querySelector('div')?.style.display).toBe('none')
    expect(onBeforeAppear).not.toHaveBeenCalled()
    expect(onAppear).not.toHaveBeenCalled()
  })

  test('direct child with initial shown v-show should trigger appear hooks once', async () => {
    const { data, onBeforeAppear, onAppear } = createAppearTestState(true)
    const App = compile(
      `<template>
        <Transition
          appear
          @before-appear="data.onBeforeAppear"
          @appear="data.onAppear"
        >
          <div v-show="data.show">foo</div>
        </Transition>
      </template>`,
      data,
    )
    const { host } = define(App as any).render()

    await nextTick()

    expect(host.querySelector('div')?.style.display).toBe('')
    expect(onBeforeAppear).toHaveBeenCalledTimes(1)
    expect(onAppear).toHaveBeenCalledTimes(1)
  })

  test('direct slot child with initial hidden v-show should not trigger appear hooks', async () => {
    const { data, onBeforeAppear, onAppear } = createAppearTestState(false)
    const Child = compile(`<template><slot /></template>`, data)
    const App = compile(
      `<template>
        <Transition
          appear
          @before-appear="data.onBeforeAppear"
          @appear="data.onAppear"
        >
          <components.Child>
            <div v-show="data.show">foo</div>
          </components.Child>
        </Transition>
      </template>`,
      data,
      { Child },
    )
    const { host } = define(App as any).render()

    await nextTick()

    expect(host.querySelector('div')?.style.display).toBe('none')
    expect(onBeforeAppear).not.toHaveBeenCalled()
    expect(onAppear).not.toHaveBeenCalled()
  })

  test('direct slot child with initial shown v-show should trigger appear hooks once', async () => {
    const { data, onBeforeAppear, onAppear } = createAppearTestState(true)
    const Child = compile(`<template><slot /></template>`, data)
    const App = compile(
      `<template>
        <Transition
          appear
          @before-appear="data.onBeforeAppear"
          @appear="data.onAppear"
        >
          <components.Child>
            <div v-show="data.show">foo</div>
          </components.Child>
        </Transition>
      </template>`,
      data,
      { Child },
    )
    const { host } = define(App as any).render()

    await nextTick()

    expect(host.querySelector('div')?.style.display).toBe('')
    expect(onBeforeAppear).toHaveBeenCalledTimes(1)
    expect(onAppear).toHaveBeenCalledTimes(1)
  })

  test('forwarded slot child with initial hidden v-show should not trigger appear hooks', async () => {
    const { data, onBeforeAppear, onAppear } = createAppearTestState(false)
    const Inner = compile(`<template><slot /></template>`, data)
    const Child = compile(
      `<template><components.Inner><slot /></components.Inner></template>`,
      data,
      { Inner },
    )
    const App = compile(
      `<template>
        <Transition
          appear
          @before-appear="data.onBeforeAppear"
          @appear="data.onAppear"
        >
          <components.Child>
            <div v-show="data.show">foo</div>
          </components.Child>
        </Transition>
      </template>`,
      data,
      { Child, Inner },
    )
    const { host } = define(App as any).render()

    await nextTick()

    expect(host.querySelector('div')?.style.display).toBe('none')
    expect(onBeforeAppear).not.toHaveBeenCalled()
    expect(onAppear).not.toHaveBeenCalled()
  })

  test('forwarded slot child with initial shown v-show should trigger appear hooks once', async () => {
    const { data, onBeforeAppear, onAppear } = createAppearTestState(true)
    const Inner = compile(`<template><slot /></template>`, data)
    const Child = compile(
      `<template><components.Inner><slot /></components.Inner></template>`,
      data,
      { Inner },
    )
    const App = compile(
      `<template>
        <Transition
          appear
          @before-appear="data.onBeforeAppear"
          @appear="data.onAppear"
        >
          <components.Child>
            <div v-show="data.show">foo</div>
          </components.Child>
        </Transition>
      </template>`,
      data,
      { Child, Inner },
    )
    const { host } = define(App as any).render()

    await nextTick()

    expect(host.querySelector('div')?.style.display).toBe('')
    expect(onBeforeAppear).toHaveBeenCalledTimes(1)
    expect(onAppear).toHaveBeenCalledTimes(1)
  })

  test('slotted component with dynamic fragment root and initial hidden v-show should not trigger appear hooks', async () => {
    const { data, onBeforeAppear, onAppear } = createAppearTestState(false, {
      ok: true,
    })
    const Child = compile(`<template><slot /></template>`, data)
    const Inner = compile(
      `<template><div v-if="data.ok">foo</div><span v-else>foo</span></template>`,
      data,
    )
    const App = compile(
      `<template>
        <Transition
          appear
          @before-appear="data.onBeforeAppear"
          @appear="data.onAppear"
        >
          <components.Child>
            <components.Inner v-show="data.show" />
          </components.Child>
        </Transition>
      </template>`,
      data,
      { Child, Inner },
    )
    const { host } = define(App as any).render()

    await nextTick()

    expect(host.querySelector('div')?.style.display).toBe('none')
    expect(onBeforeAppear).not.toHaveBeenCalled()
    expect(onAppear).not.toHaveBeenCalled()
  })

  test('dynamic default slot source should trigger enter hooks when toggled on', async () => {
    const onBeforeEnter = vi.fn()
    const onEnter = vi.fn()
    const data = ref({
      show: false,
      onBeforeEnter,
      onEnter,
    })
    const App = compile(
      `<template>
        <button @click="data.show = !data.show">toggle</button>
        <Transition
          @before-enter="data.onBeforeEnter"
          @enter="data.onEnter"
        >
          <template #default v-if="data.show">
            <div>foo</div>
          </template>
        </Transition>
      </template>`,
      data,
    )
    const { host } = define(App as any).render()

    host.querySelector('button')!.click()
    await nextTick()

    expect(host.innerHTML).toContain(
      '<div class="v-enter-from v-enter-active">foo</div>',
    )
    expect(onBeforeEnter).toHaveBeenCalledTimes(1)
    expect(onEnter).toHaveBeenCalledTimes(1)
  })

  test('dynamic default slot source should trigger leave hooks when toggled off', async () => {
    const onBeforeLeave = vi.fn()
    const onLeave = vi.fn()
    const data = ref({
      show: true,
      onBeforeLeave,
      onLeave,
    })
    const App = compile(
      `<template>
        <button @click="data.show = !data.show">toggle</button>
        <Transition
          @before-leave="data.onBeforeLeave"
          @leave="data.onLeave"
        >
          <template #default v-if="data.show">
            <div>foo</div>
          </template>
        </Transition>
      </template>`,
      data,
    )
    const { host } = define(App as any).render()

    host.querySelector('button')!.click()
    await nextTick()

    expect(host.innerHTML).toContain(
      '<div class="v-leave-from v-leave-active">foo</div>',
    )
    expect(onBeforeLeave).toHaveBeenCalledTimes(1)
    expect(onLeave).toHaveBeenCalledTimes(1)
  })

  test('dynamic default slot source should respect reactive mode changes', async () => {
    const onLeave = vi.fn((_: Element, done: () => void) => setTimeout(done, 0))
    const data = ref({
      mode: 'default',
      show: true,
      onLeave,
    })
    const App = compile(
      `<template>
        <Transition :mode="data.mode" @leave="data.onLeave">
          <template #default v-if="data.show">
            <div>A</div>
          </template>
          <template #default v-else>
            <div>B</div>
          </template>
        </Transition>
      </template>`,
      data,
    )
    const { host } = define(App as any).render()

    data.value.mode = 'out-in'
    await nextTick()

    data.value.show = false
    await nextTick()

    expect(host.textContent).toContain('A')
    expect(host.textContent).not.toContain('B')

    await new Promise(r => setTimeout(r, 0))
    await nextTick()

    expect(host.textContent).toContain('B')
    expect(onLeave).toHaveBeenCalledTimes(1)
  })
})
