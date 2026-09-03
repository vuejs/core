import {
  createComponent,
  defineVaporComponent,
  setBlockKey,
  template,
} from '../../src'
import { resolveTransitionBlock } from '../../src/components/Transition'
import { resolveTransitionBlocks } from '../../src/components/TransitionGroup'
import {
  Fragment,
  type Ref,
  Teleport,
  Transition,
  type VNode,
  defineComponent,
  h,
  nextTick,
  ref,
} from 'vue'
import { compile, makeInteropRender, makeRender } from '../_utils'

const define = makeRender()
const defineInterop = makeInteropRender()

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

interface InteropSlotTransitionTestData {
  show: boolean
  onEnter: (el: Element, done: () => void) => void
  onLeave: (el: Element, done: () => void) => void
}

function renderInteropSlotFallbackTransition<
  T extends InteropSlotTransitionTestData,
>(
  mode: 'out-in' | 'in-out',
  data: Ref<T>,
  renderContent: () => VNode = () => h('span', { class: 'content' }, 'content'),
  fallback: string = '<div class="fallback">fallback</div>',
  removeSlotWhenHidden = false,
) {
  const Child = compile(
    `<template>
      <Transition
        mode="${mode}"
        :css="false"
        @enter="data.onEnter"
        @leave="data.onLeave"
      >
        <slot>${fallback}</slot>
      </Transition>
    </template>`,
    data,
  )
  const App = defineComponent({
    setup() {
      return () =>
        h(
          Child,
          null,
          removeSlotWhenHidden && !data.value.show
            ? undefined
            : {
                default: () => (data.value.show ? renderContent() : []),
              },
        )
    },
  })
  return defineInterop(App).render()
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

  test('keeps unkeyed child key undefined (shares leaving bucket by type)', () => {
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

    // No explicit key: the resolved child must stay unkeyed so successive
    // instances of the same component type share the leaving-cache bucket
    // and earlyRemove can match the previous still-leaving instance.
    const resolved = resolveTransitionBlock(child)!
    expect(resolved.$key).toBeUndefined()
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

    // A null key counts as absent and must not fall back to uid; the resolved
    // child keeps its nullish key (stable across same-type instances, so it
    // shares the leaving bucket by type).
    const resolved = resolveTransitionBlock(child)!
    expect(resolved.$key).toBeNull()
    expect(resolved.$key).not.toBe(child.uid)
  })

  test('collects group leaves with component key prefixes', () => {
    const Child = defineVaporComponent({
      setup() {
        return [
          document.createComment('anchor'),
          template(`<div>a</div>`)() as any,
          template(`<div>b</div>`)() as any,
        ]
      },
    })

    let child: any
    define({
      setup() {
        child = createComponent(Child)
        setBlockKey(child, 'foo')
        child.block[1].$key = undefined
        child.block[2].$key = undefined
        return child
      },
    }).render()

    const resolved = resolveTransitionBlocks(child)
    expect(resolved).toEqual([child.block[1], child.block[2]])
    expect(child.block[1].$key).toBe('foo0')
    expect(child.block[2].$key).toBe('foo1')
  })

  test('keeps inherited group keys stable across repeated resolutions', () => {
    const Child = defineVaporComponent({
      setup() {
        return [
          document.createComment('anchor'),
          template(`<div>a</div>`)() as any,
          template(`<div>b</div>`)() as any,
        ]
      },
    })

    let child: any
    define({
      setup() {
        child = createComponent(Child)
        setBlockKey(child, 'foo')
        child.block[1].$key = undefined
        child.block[2].$key = undefined
        return child
      },
    }).render()

    resolveTransitionBlocks(child)
    resolveTransitionBlocks(child)

    expect(child.block[1].$key).toBe('foo0')
    expect(child.block[2].$key).toBe('foo1')
  })

  test('treats null group owner key as absent', () => {
    const Child = defineVaporComponent({
      setup() {
        return [
          template(`<div>a</div>`)() as any,
          template(`<div>b</div>`)() as any,
        ]
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

    resolveTransitionBlocks(child)

    expect(child.block[0].$key).toBeUndefined()
    expect(child.block[1].$key).toBeUndefined()
  })

  test('composes nested group key prefixes', () => {
    const data = ref({ items: [{ key: 'bar' }] })
    const Child = compile(
      `<template>
        <span></span>
        <div v-for="item in data.items" :key="item.key">child</div>
      </template>`,
      data,
    )

    let child: any
    define({
      setup() {
        child = createComponent(Child)
        setBlockKey(child, 'foo')
        return child
      },
    }).render()

    const resolved = resolveTransitionBlocks(child)

    expect(resolved[0].$key).toBe('foo0')
    expect(resolved[1].$key).toBe('foobar')
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

  test('direct child with initial shown v-show should call appear after insertion', async () => {
    const calls: boolean[] = []
    const data = ref({
      show: true,
      onBeforeAppear: (el: Element) => calls.push(el.isConnected),
      onAppear: (el: Element) => calls.push(el.isConnected),
    })
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
    define(App as any).render()

    await nextTick()

    expect(calls).toEqual([false, true])
  })

  // #15202
  test('should not track reactive reads from v-show transition hooks', async () => {
    const show = ref(false)
    const count = ref(0)
    const source = vi.fn(() => show.value)
    const onBeforeEnter = vi.fn(() => count.value++)
    const data = ref({ source, onBeforeEnter })
    const App = compile(
      `<template>
        <Transition :css="false" @before-enter="data.onBeforeEnter">
          <div v-show="data.source()">content</div>
        </Transition>
      </template>`,
      data,
    )
    define(App as any).render()

    show.value = true
    await nextTick()

    expect(onBeforeEnter).toHaveBeenCalledTimes(1)
    expect(count.value).toBe(1)
    expect(source).toHaveBeenCalledTimes(2)
  })

  test('should not repeat v-show transition when truthiness is unchanged', async () => {
    const onBeforeEnter = vi.fn()
    const data = ref({
      show: 0,
      onBeforeEnter,
    })
    const App = compile(
      `<template>
        <Transition :css="false" @before-enter="data.onBeforeEnter">
          <div v-show="data.show">content</div>
        </Transition>
      </template>`,
      data,
    )
    define(App as any).render()

    data.value.show = 1
    await nextTick()
    expect(onBeforeEnter).toHaveBeenCalledTimes(1)

    data.value.show = 2
    await nextTick()
    expect(onBeforeEnter).toHaveBeenCalledTimes(1)
  })

  test('v-if should own enter and leave when its root also has v-show', async () => {
    const onEnter = vi.fn((_el: Element, done: () => void) => done())
    const onLeave = vi.fn((_el: Element, done: () => void) => done())
    const data = ref({
      show: true,
      onEnter,
      onLeave,
    })
    const App = compile(
      `<template>
        <Transition
          :css="false"
          @enter="data.onEnter"
          @leave="data.onLeave"
        >
          <div v-if="data.show" v-show="true">foo</div>
        </Transition>
      </template>`,
      data,
    )
    const { host } = define(App as any).render()

    data.value.show = false
    await nextTick()

    expect(onLeave).toHaveBeenCalledTimes(1)
    expect(host.querySelector('div')).toBeNull()

    data.value.show = true
    await nextTick()

    expect(onEnter).toHaveBeenCalledTimes(1)
    expect(host.querySelector('div')?.textContent).toBe('foo')
  })

  test('appear should not persist a v-show root owned by v-if', async () => {
    const onLeave = vi.fn((_el: Element, done: () => void) => done())
    const data = ref({
      show: true,
      onLeave,
    })
    const App = compile(
      `<template>
        <Transition appear :css="false" @leave="data.onLeave">
          <div v-if="data.show" v-show="true">foo</div>
        </Transition>
      </template>`,
      data,
    )
    const { host } = define(App as any).render()

    await nextTick()
    data.value.show = false
    await nextTick()

    expect(onLeave).toHaveBeenCalledTimes(1)
    expect(host.querySelector('div')).toBeNull()
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

  // Runtime-derived persisted (slot-propagated roots): independent of
  // `appear`/`mode`, structural when a v-if/v-for/dynamic-slot boundary sits
  // between Transition and the v-show target.
  test('slotted v-if root with v-show leaves on removal with appear', async () => {
    const onLeave = vi.fn((_el: Element, done: () => void) => done())
    const data = ref({ visible: true, onLeave })
    const Child = compile(
      `<template><div v-if="data.visible" v-show="true">foo</div></template>`,
      data,
    )
    const App = compile(
      `<template>
        <Transition appear :css="false" @leave="data.onLeave">
          <components.Child />
        </Transition>
      </template>`,
      data,
      { Child },
    )
    const { host } = define(App as any).render()
    await nextTick()

    data.value.visible = false
    await nextTick()
    expect(onLeave).toHaveBeenCalledOnce()
    expect(host.querySelector('div')).toBeNull()
  })

  test('dynamic slot swap of v-show roots animates with appear', async () => {
    const onEnter = vi.fn((_el: Element, done: () => void) => done())
    const onLeave = vi.fn((_el: Element, done: () => void) => done())
    const data = ref({ branch: true, show: true, onEnter, onLeave })
    const Child = compile(`<template><slot /></template>`, data)
    const App = compile(
      `<template>
        <Transition appear :css="false" @enter="data.onEnter" @leave="data.onLeave">
          <template #default v-if="data.branch">
            <components.Child>
              <div v-show="data.show">foo</div>
            </components.Child>
          </template>
          <template #default v-else>
            <components.Child>
              <div v-show="data.show">bar</div>
            </components.Child>
          </template>
        </Transition>
      </template>`,
      data,
      { Child },
    )
    const { host } = define(App as any).render()
    await nextTick()
    onEnter.mockClear()

    data.value.branch = false
    await nextTick()
    expect(host.textContent).toContain('bar')
    expect(onLeave).toHaveBeenCalledOnce()
    expect(onEnter).toHaveBeenCalledOnce()
    onEnter.mockClear()
    onLeave.mockClear()

    // the new root keeps v-show driven transitions
    data.value.show = false
    await nextTick()
    expect(onLeave).toHaveBeenCalledOnce()
    expect(host.querySelector('div')?.style.display).toBe('none')

    data.value.show = true
    await nextTick()
    expect(onEnter).toHaveBeenCalledOnce()
    expect(host.querySelector('div')?.style.display).toBe('')
  })

  test('dynamic slot removal of a v-show root leaves with appear', async () => {
    const onLeave = vi.fn((_el: Element, done: () => void) => done())
    const data = ref({ branch: true, onLeave })
    const Child = compile(`<template><slot /></template>`, data)
    const App = compile(
      `<template>
        <Transition appear :css="false" @leave="data.onLeave">
          <template #default v-if="data.branch">
            <components.Child>
              <div v-show="true">foo</div>
            </components.Child>
          </template>
        </Transition>
      </template>`,
      data,
      { Child },
    )
    const { host } = define(App as any).render()
    await nextTick()

    data.value.branch = false
    await nextTick()
    expect(onLeave).toHaveBeenCalledOnce()
    expect(host.querySelector('div')).toBeNull()
  })

  test.each([false, true])(
    'slotted v-show component with dynamic root swaps branch as persisted (appear: %s)',
    async appear => {
      const onEnter = vi.fn((_el: Element, done: () => void) => done())
      const onLeave = vi.fn((_el: Element, done: () => void) => done())
      const data = ref({ ok: true, onEnter, onLeave })
      const Child = compile(`<template><slot /></template>`, data)
      const Inner = compile(
        `<template><div v-if="data.ok">foo</div><span v-else>bar</span></template>`,
        data,
      )
      const App = compile(
        `<template>
          <Transition :appear="${appear}" :css="false" @enter="data.onEnter" @leave="data.onLeave">
            <components.Child>
              <components.Inner v-show="true" />
            </components.Child>
          </Transition>
        </template>`,
        data,
        { Child, Inner },
      )
      const { host } = define(App as any).render()
      await nextTick()
      onEnter.mockClear()

      data.value.ok = false
      await nextTick()
      expect(host.querySelector('span')?.textContent).toBe('bar')
      // same as a direct `<Inner v-show>` child: the new root enters, the
      // old root is removed without a leave
      expect(onEnter).toHaveBeenCalledOnce()
      expect(onLeave).not.toHaveBeenCalled()
    },
  )

  test.each(['direct', 'slotted'])(
    'hidden v-show component with dynamic root swaps branch without hooks (%s)',
    async placement => {
      const onBeforeEnter = vi.fn()
      const onBeforeLeave = vi.fn()
      const data = ref({ ok: true, onBeforeEnter, onBeforeLeave })
      const Child = compile(`<template><slot /></template>`, data)
      const Inner = compile(
        `<template><div v-if="data.ok">foo</div><span v-else>bar</span></template>`,
        data,
      )
      const App = compile(
        `<template>
          <Transition :css="false" @before-enter="data.onBeforeEnter" @before-leave="data.onBeforeLeave">
            ${
              placement === 'slotted'
                ? '<components.Child><components.Inner v-show="false" /></components.Child>'
                : '<components.Inner v-show="false" />'
            }
          </Transition>
        </template>`,
        data,
        { Child, Inner },
      )
      const { host } = define(App as any).render()
      await nextTick()

      data.value.ok = false
      await nextTick()
      expect(host.querySelector('span')?.style.display).toBe('none')
      expect(onBeforeEnter).not.toHaveBeenCalled()
      expect(onBeforeLeave).not.toHaveBeenCalled()
    },
  )

  test('appear on a persisted root without v-show does not enter', async () => {
    const onBeforeAppear = vi.fn()
    const data = ref({ onBeforeAppear })
    const App = compile(
      `<template>
        <Transition appear persisted :css="false" @before-appear="data.onBeforeAppear">
          <div>foo</div>
        </Transition>
      </template>`,
      data,
    )
    define(App as any).render()
    await nextTick()
    expect(onBeforeAppear).not.toHaveBeenCalled()
  })

  test('appear on a v-if root with v-show enters once', async () => {
    const onBeforeAppear = vi.fn()
    const onAppear = vi.fn((_el: Element, done: () => void) => done())
    const data = ref({ visible: true, onBeforeAppear, onAppear })
    const App = compile(
      `<template>
        <Transition appear :css="false" @before-appear="data.onBeforeAppear" @appear="data.onAppear">
          <div v-if="data.visible" v-show="true">foo</div>
        </Transition>
      </template>`,
      data,
    )
    define(App as any).render()
    await nextTick()
    expect(onBeforeAppear).toHaveBeenCalledOnce()
    expect(onAppear).toHaveBeenCalledOnce()
  })

  test('out-in mode does not stall on a persisted root branch swap', async () => {
    const data = ref({ ok: true })
    const Inner = compile(
      `<template><div v-if="data.ok">foo</div><span v-else>bar</span></template>`,
      data,
    )
    const App = compile(
      `<template>
        <Transition mode="out-in" :css="false">
          <components.Inner v-show="true" />
        </Transition>
      </template>`,
      data,
      { Inner },
    )
    const { host } = define(App as any).render()
    await nextTick()

    data.value.ok = false
    await nextTick()
    expect(host.querySelector('span')?.textContent).toBe('bar')

    data.value.ok = true
    await nextTick()
    expect(host.querySelector('div')?.textContent).toBe('foo')
  })

  test('does not leak persisted from a v-show branch onto a non-v-show root', async () => {
    let leaveCalls = 0
    let leaveDone: (() => void) | undefined
    const data = ref<any>({
      b: 1,
      show: true,
      onLeave: (_el: Element, done: () => void) => {
        leaveCalls++
        leaveDone = done
      },
    })
    const App = compile(
      `<template>
        <Transition appear name="t" @leave="data.onLeave">
          <template #default v-if="data.b === 1">
            <div v-show="data.show">foo</div>
          </template>
          <template #default v-else-if="data.b === 2">
            <span>bar</span>
          </template>
        </Transition>
      </template>`,
      data,
    )
    const { host } = define(App as any).render()
    await nextTick()

    // visit the v-show branch (latches the runtime-derived persisted), then
    // swap to a non-v-show root.
    data.value.b = 2
    await nextTick()
    expect(host.querySelector('span')?.textContent).toBe('bar')
    leaveCalls = 0

    // structurally remove the non-v-show span. The leaked persisted=true would
    // make performTransitionLeave skip the leave entirely (span vanishes,
    // leaveCalls stays 0); with the fix the span leaves normally.
    data.value.b = 3
    await nextTick()
    expect(leaveCalls).toBe(1)
    const span = host.querySelector('span')!
    expect(span.className).toContain('t-leave-active')

    leaveDone && leaveDone()
  })

  test('does not carry persisted into a structural v-if root', async () => {
    const onLeave = vi.fn((_el: Element, done: () => void) => done())
    const data = ref({
      branch: true,
      show: true,
      visible: true,
      onLeave,
    })
    const Child = compile(`<template><slot /></template>`, data)
    const App = compile(
      `<template>
        <Transition appear :css="false" @leave="data.onLeave">
          <template #default v-if="data.branch">
            <components.Child>
              <div v-show="data.show">foo</div>
            </components.Child>
          </template>
          <template #default v-else>
            <div v-if="data.visible" v-show="true">bar</div>
          </template>
        </Transition>
      </template>`,
      data,
      { Child },
    )
    const { host } = define(App as any).render()
    await nextTick()

    data.value.branch = false
    await nextTick()
    expect(host.querySelector('div')?.textContent).toBe('bar')
    onLeave.mockClear()

    data.value.visible = false
    await nextTick()
    expect(onLeave).toHaveBeenCalledOnce()
    expect(host.querySelector('div')).toBeNull()
  })

  test('does not early-remove across mixed number/string keys of equal value', async () => {
    let leaveDone: (() => void) | undefined
    const data = ref<any>({
      k: 1,
      onLeave: (_el: Element, done: () => void) => {
        leaveDone = done
      },
    })
    const App = compile(
      `<template>
        <Transition name="t" @leave="data.onLeave">
          <div :key="data.k">{{ data.k }}</div>
        </Transition>
      </template>`,
      data,
    )
    const { host } = define(App as any).render()
    await nextTick()

    // 1 (number) -> '1' (string): same String($key) bucket, different raw key.
    // The leaving number-keyed node must NOT be early-removed by the entering
    // string-keyed node, so both coexist during the leave (matching VDOM's
    // isSameVNodeType raw-key guard). Without the guard the leaving node is
    // force-removed and only 1 element remains.
    data.value.k = '1'
    await nextTick()
    expect(host.querySelectorAll('div').length).toBe(2)

    leaveDone && leaveDone()
  })

  test('vdom slot content should wait for fallback leave in out-in mode', async () => {
    let leaveDone: (() => void) | undefined
    const onEnter = vi.fn((_el: Element, done: () => void) => done())
    const onLeave = vi.fn((_el: Element, done: () => void) => {
      leaveDone = done
    })
    const data = ref({
      show: false,
      onEnter,
      onLeave,
    })
    const { host } = renderInteropSlotFallbackTransition('out-in', data)

    expect(host.querySelector('.fallback')).not.toBeNull()

    data.value.show = true
    await nextTick()

    expect(onLeave).toHaveBeenCalledOnce()
    expect(host.querySelector('.fallback')).not.toBeNull()
    expect(host.querySelector('.content')).toBeNull()

    leaveDone!()
    await nextTick()

    expect(host.querySelector('.fallback')).toBeNull()
    expect(host.querySelector('.content')).not.toBeNull()
    expect(onEnter).toHaveBeenCalledOnce()
  })

  test('slot fallback should wait for vdom content leave in out-in mode', async () => {
    let leaveDone: (() => void) | undefined
    const onEnter = vi.fn((_el: Element, done: () => void) => done())
    const onLeave = vi.fn((_el: Element, done: () => void) => {
      leaveDone = done
    })
    const data = ref({
      show: true,
      onEnter,
      onLeave,
    })
    const { host } = renderInteropSlotFallbackTransition('out-in', data)

    expect(host.querySelector('.content')).not.toBeNull()

    data.value.show = false
    await nextTick()

    expect(onLeave).toHaveBeenCalledOnce()
    expect(host.querySelector('.content')).not.toBeNull()
    expect(host.querySelector('.fallback')).toBeNull()

    leaveDone!()
    await nextTick()

    expect(host.querySelector('.content')).toBeNull()
    expect(host.querySelector('.fallback')).not.toBeNull()
    expect(onEnter).toHaveBeenCalledOnce()
  })

  test('removed vdom slot should respect out-in mode', async () => {
    let leaveDone: (() => void) | undefined
    const onEnter = vi.fn((_el: Element, done: () => void) => done())
    const onLeave = vi.fn((_el: Element, done: () => void) => {
      leaveDone = done
    })
    const data = ref({
      show: true,
      onEnter,
      onLeave,
    })
    const { host } = renderInteropSlotFallbackTransition(
      'out-in',
      data,
      undefined,
      undefined,
      true,
    )

    data.value.show = false
    await nextTick()

    expect(onLeave).toHaveBeenCalledOnce()
    expect(host.querySelector('.content')).not.toBeNull()
    expect(host.querySelector('.fallback')).toBeNull()

    leaveDone!()
    await nextTick()

    expect(host.querySelector('.content')).toBeNull()
    expect(host.querySelector('.fallback')).not.toBeNull()
    expect(onEnter).toHaveBeenCalledOnce()
  })

  test('unmounts a leaving fallback during an out-in switch', async () => {
    let leaveDone: (() => void) | undefined
    const data = ref({
      show: false,
      onEnter: vi.fn(),
      onLeave: vi.fn((_el: Element, done: () => void) => {
        leaveDone = done
      }),
    })
    const { app, host } = renderInteropSlotFallbackTransition('out-in', data)

    data.value.show = true
    await nextTick()

    expect(leaveDone).toBeDefined()
    expect(host.querySelector('.fallback')).not.toBeNull()

    app.unmount()
    await nextTick()

    expect(host.innerHTML).toBe('')

    leaveDone!()
    await nextTick()
    expect(host.innerHTML).toBe('')
  })

  test('unmounts leaving vdom content during an out-in switch', async () => {
    let leaveDone: (() => void) | undefined
    const data = ref({
      show: true,
      onEnter: vi.fn(),
      onLeave: vi.fn((_el: Element, done: () => void) => {
        leaveDone = done
      }),
    })
    const { app, host } = renderInteropSlotFallbackTransition('out-in', data)

    data.value.show = false
    await nextTick()

    expect(leaveDone).toBeDefined()
    expect(host.querySelector('.content')).not.toBeNull()

    app.unmount()
    await nextTick()

    expect(host.innerHTML).toBe('')

    leaveDone!()
    await nextTick()
    expect(host.innerHTML).toBe('')
  })

  test('unmounts a leaving Vapor component used as vdom slot content', async () => {
    let leaveDone: (() => void) | undefined
    const Content = defineVaporComponent({
      setup() {
        return template('<span class="content">content</span>')()
      },
    })
    const data = ref({
      show: true,
      onEnter: vi.fn(),
      onLeave: vi.fn((_el: Element, done: () => void) => {
        leaveDone = done
      }),
    })
    const { app, host } = renderInteropSlotFallbackTransition(
      'out-in',
      data,
      () => h(Content),
    )

    data.value.show = false
    await nextTick()

    expect(leaveDone).toBeDefined()
    expect(host.querySelector('.content')).not.toBeNull()

    app.unmount()
    await nextTick()

    expect(host.innerHTML).toBe('')

    leaveDone!()
    await nextTick()
    expect(host.innerHTML).toBe('')
  })

  test('unmounts leaving Teleport content from its target', async () => {
    let leaveDone: (() => void) | undefined
    const target = document.createElement('div')
    document.body.appendChild(target)
    const data = ref({
      show: true,
      onEnter: vi.fn(),
      onLeave: vi.fn((_el: Element, done: () => void) => {
        leaveDone = done
      }),
    })
    const { app, host } = renderInteropSlotFallbackTransition(
      'out-in',
      data,
      () =>
        h(Teleport, { to: target }, [
          h('span', { class: 'content' }, 'content'),
        ]),
    )

    data.value.show = false
    await nextTick()

    expect(leaveDone).toBeDefined()
    expect(target.querySelector('.content')).not.toBeNull()

    app.unmount()
    await nextTick()

    expect(host.innerHTML).toBe('')
    expect(target.innerHTML).toBe('')

    leaveDone!()
    await nextTick()
    expect(target.innerHTML).toBe('')
    target.remove()
  })

  test('slot fallback should wait for vdom content enter in in-out mode', async () => {
    let enterDone: (() => void) | undefined
    let leaveDone: (() => void) | undefined
    const onEnter = vi.fn((_el: Element, done: () => void) => {
      enterDone = done
    })
    const onLeave = vi.fn((_el: Element, done: () => void) => {
      leaveDone = done
    })
    const data = ref({
      show: false,
      onEnter,
      onLeave,
    })
    const { host } = renderInteropSlotFallbackTransition('in-out', data)

    data.value.show = true
    await nextTick()

    expect(onEnter).toHaveBeenCalledOnce()
    expect(onLeave).not.toHaveBeenCalled()
    expect(host.querySelector('.fallback')).not.toBeNull()
    expect(host.querySelector('.content')).not.toBeNull()

    enterDone!()

    expect(onLeave).toHaveBeenCalledOnce()
    expect(host.querySelector('.fallback')).not.toBeNull()

    leaveDone!()
    expect(host.querySelector('.fallback')).toBeNull()
    expect(host.querySelector('.content')).not.toBeNull()
  })

  test('vdom slot content should wait for fallback enter in in-out mode', async () => {
    let enterDone: (() => void) | undefined
    let leaveDone: (() => void) | undefined
    const onEnter = vi.fn((_el: Element, done: () => void) => {
      enterDone = done
    })
    const onLeave = vi.fn((_el: Element, done: () => void) => {
      leaveDone = done
    })
    const data = ref({
      show: true,
      onEnter,
      onLeave,
    })
    const { host } = renderInteropSlotFallbackTransition('in-out', data)

    data.value.show = false
    await nextTick()

    expect(onEnter).toHaveBeenCalledOnce()
    expect(onLeave).not.toHaveBeenCalled()
    expect(host.querySelector('.content')).not.toBeNull()
    expect(host.querySelector('.fallback')).not.toBeNull()

    enterDone!()

    expect(onLeave).toHaveBeenCalledOnce()
    expect(host.querySelector('.content')).not.toBeNull()

    leaveDone!()
    expect(host.querySelector('.content')).toBeNull()
    expect(host.querySelector('.fallback')).not.toBeNull()
  })

  test('removed vdom slot should respect in-out mode', async () => {
    let enterDone: (() => void) | undefined
    let leaveDone: (() => void) | undefined
    const onEnter = vi.fn((_el: Element, done: () => void) => {
      enterDone = done
    })
    const onLeave = vi.fn((_el: Element, done: () => void) => {
      leaveDone = done
    })
    const data = ref({
      show: true,
      onEnter,
      onLeave,
    })
    const { host } = renderInteropSlotFallbackTransition(
      'in-out',
      data,
      undefined,
      undefined,
      true,
    )

    data.value.show = false
    await nextTick()

    expect(onEnter).toHaveBeenCalledOnce()
    expect(onLeave).not.toHaveBeenCalled()
    expect(host.querySelector('.content')).not.toBeNull()
    expect(host.querySelector('.fallback')).not.toBeNull()

    enterDone!()

    expect(onLeave).toHaveBeenCalledOnce()
    expect(host.querySelector('.content')).not.toBeNull()

    leaveDone!()
    expect(host.querySelector('.content')).toBeNull()
    expect(host.querySelector('.fallback')).not.toBeNull()
  })

  test('out-in should not wait for an invalid slot fallback', async () => {
    const onEnter = vi.fn((_el: Element, done: () => void) => done())
    const onLeave = vi.fn()
    const data = ref({
      show: false,
      fallbackVisible: false,
      onEnter,
      onLeave,
    })
    const { host } = renderInteropSlotFallbackTransition(
      'out-in',
      data,
      undefined,
      '<div v-if="data.fallbackVisible" class="fallback">fallback</div>',
    )

    data.value.show = true
    await nextTick()

    expect(host.querySelector('.fallback')).toBeNull()
    expect(host.querySelector('.content')).not.toBeNull()
    expect(onLeave).not.toHaveBeenCalled()
    expect(onEnter).toHaveBeenCalledOnce()
  })

  test('in-out should not delay vdom leave for an invalid slot fallback', async () => {
    let leaveDone: (() => void) | undefined
    const onEnter = vi.fn((_el: Element, done: () => void) => done())
    const onLeave = vi.fn((_el: Element, done: () => void) => {
      leaveDone = done
    })
    const data = ref({
      show: true,
      fallbackVisible: false,
      onEnter,
      onLeave,
    })
    const { host } = renderInteropSlotFallbackTransition(
      'in-out',
      data,
      undefined,
      '<div v-if="data.fallbackVisible" class="fallback">fallback</div>',
    )

    data.value.show = false
    await nextTick()

    expect(onEnter).not.toHaveBeenCalled()
    expect(onLeave).toHaveBeenCalledOnce()
    expect(host.querySelector('.content')).not.toBeNull()

    leaveDone!()
    expect(host.querySelector('.content')).toBeNull()
  })

  test('in-out should handle switching back to vdom before fallback enter finishes', async () => {
    let fallbackEnterDone: (() => void) | undefined
    let contentEnterDone: (() => void) | undefined
    let leaveDone: (() => void) | undefined
    const onEnter = vi.fn((el: Element, done: () => void) => {
      if (el.classList.contains('fallback')) {
        fallbackEnterDone = done
      } else {
        contentEnterDone = done
      }
    })
    const onLeave = vi.fn((_el: Element, done: () => void) => {
      leaveDone = done
    })
    const data = ref({
      show: true,
      onEnter,
      onLeave,
    })
    const { host } = renderInteropSlotFallbackTransition('in-out', data)

    data.value.show = false
    await nextTick()

    expect(fallbackEnterDone).toBeDefined()
    expect(onLeave).not.toHaveBeenCalled()

    data.value.show = true
    await nextTick()

    expect(contentEnterDone).toBeDefined()
    expect(onLeave).not.toHaveBeenCalled()

    contentEnterDone!()
    expect(onLeave).toHaveBeenCalledOnce()

    leaveDone!()
    expect(host.querySelector('.fallback')).toBeNull()
    expect(host.querySelectorAll('.content')).toHaveLength(1)
  })

  test('out-in fallback switch should render the latest vdom slot content', async () => {
    let leaveDone: (() => void) | undefined
    const onEnter = vi.fn((_el: Element, done: () => void) => done())
    const onLeave = vi.fn((_el: Element, done: () => void) => {
      leaveDone = done
    })
    const data = ref({
      show: false,
      tag: 'span',
      text: 'A',
      onEnter,
      onLeave,
    })
    const { host } = renderInteropSlotFallbackTransition('out-in', data, () =>
      h(data.value.tag, { class: 'content' }, data.value.text),
    )

    data.value.show = true
    await nextTick()

    data.value.show = false
    await nextTick()

    data.value.tag = 'p'
    data.value.text = 'B'
    data.value.show = true
    await nextTick()

    expect(onLeave).toHaveBeenCalledOnce()
    expect(host.querySelector('.content')).toBeNull()

    leaveDone!()
    await nextTick()

    expect(host.querySelector('span')).toBeNull()
    expect(host.querySelector('p.content')?.textContent).toBe('B')
    expect(onEnter).toHaveBeenCalledOnce()
  })

  test('out-in fallback switch should handle synchronous leave completion', async () => {
    const onEnter = vi.fn((_el: Element, done: () => void) => done())
    const onLeave = vi.fn((_el: Element, done: () => void) => done())
    const data = ref({
      show: false,
      onEnter,
      onLeave,
    })
    const { host } = renderInteropSlotFallbackTransition('out-in', data)

    data.value.show = true
    await nextTick()

    expect(onLeave).toHaveBeenCalledOnce()
    expect(host.querySelector('.fallback')).toBeNull()
    expect(host.querySelector('.content')).not.toBeNull()
    expect(onEnter).toHaveBeenCalledOnce()
  })

  test('does not treat inherited VDOM transition hooks as Vapor state', async () => {
    const show = ref(true)
    const onEnter = vi.fn()
    const onLeave = vi.fn()
    const Child = compile(`<template><slot /></template>`, show)
    const App = defineComponent({
      setup() {
        return () => {
          // Force BaseTransition to propagate refreshed VDOM hooks through the
          // slot root.
          const visible = show.value
          return h(
            Transition,
            { mode: 'out-in', css: false, onEnter, onLeave },
            {
              default: () =>
                h(
                  Child,
                  { visible },
                  {
                    default: () =>
                      visible ? h('div', { id: 'content' }, 'content') : [],
                  },
                ),
            },
          )
        }
      },
    })
    const { host } = defineInterop(App).render()

    show.value = false
    await nextTick()

    expect(host.querySelector('#content')).toBeNull()
    expect(onEnter).not.toHaveBeenCalled()
    expect(onLeave).not.toHaveBeenCalled()
  })

  test('preserves multi-element vdom slot content nested under transition root', () => {
    const data = ref({})
    const Child = compile(
      `<script setup vapor>
        defineProps({ show: Boolean })
      </script>
      <template>
        <Transition>
          <div v-if="show" class="with-transition">
            <slot />
          </div>
        </Transition>
      </template>`,
      data,
    )
    const App = compile(
      `<script setup>
        const Child = _components.Child
      </script>
      <template>
        <Child :show="true">
          <button class="first">First</button>
          <button class="last">Last</button>
        </Child>
      </template>`,
      data,
      { Child },
      { vapor: false },
    )
    const { host } = defineInterop(App as any).render()

    expect(
      '<transition> can only be used on a single element or component',
    ).not.toHaveBeenWarned()
    expect(
      Array.from(host.querySelectorAll('.with-transition > button')).map(
        el => el.textContent,
      ),
    ).toEqual(['First', 'Last'])
  })

  test('vdom slot content should participate in transitions', async () => {
    let enterDone: (() => void) | undefined
    let leaveDone: (() => void) | undefined
    const onEnter = vi.fn((_el: Element, done: () => void) => {
      enterDone = done
    })
    const onLeave = vi.fn((_el: Element, done: () => void) => {
      leaveDone = done
    })
    const data = ref({ show: true, onEnter, onLeave })
    const Child = compile(
      `<template>
        <Transition
          :css="false"
          @enter="data.onEnter"
          @leave="data.onLeave"
        >
          <slot />
        </Transition>
      </template>`,
      data,
    )
    const App = compile(
      `<script setup>
        const data = _data
        const components = _components
      </script>
      <template>
        <components.Child>
          <div v-if="data.show">slot</div>
        </components.Child>
      </template>`,
      data,
      { Child },
      { vapor: false },
    )
    const { host } = defineInterop(App as any).render()

    expect(host.querySelector('div')?.textContent).toBe('slot')

    data.value.show = false
    await nextTick()

    expect(onLeave).toHaveBeenCalledOnce()
    expect(host.querySelector('div')?.textContent).toBe('slot')

    leaveDone!()
    expect(host.querySelector('div')).toBeNull()

    data.value.show = true
    await nextTick()

    expect(onEnter).toHaveBeenCalledOnce()
    expect(host.querySelector('div')?.textContent).toBe('slot')

    enterDone!()
  })

  test('vdom slot fragment keys should control transition child identity', async () => {
    const key = ref('a')
    const Child = compile(
      `<template>
        <Transition name="fade">
          <slot />
        </Transition>
      </template>`,
      key,
    )
    const App = defineComponent({
      setup() {
        return () =>
          h(Child, null, {
            default: () => [
              h(Fragment, { key: key.value }, [h('div', 'slot')]),
            ],
          })
      },
    })
    const { host } = defineInterop(App).render()
    const leaving = host.querySelector('div')!

    key.value = 'b'
    await nextTick()

    const children = Array.from(host.querySelectorAll('div'))
    const entering = children.find(child => child !== leaving)!
    expect(children).toHaveLength(2)
    expect(leaving.className).toBe('fade-leave-from fade-leave-active')
    expect(entering.className).toBe('fade-enter-from fade-enter-active')
  })

  test('vdom slot content should respect out-in transition mode', async () => {
    let leaveDone: (() => void) | undefined
    let finishLeaveSynchronously = false
    const onLeave = vi.fn((_el: Element, done: () => void) => {
      leaveDone = done
      if (finishLeaveSynchronously) done()
    })
    const onEnter = vi.fn((_el: Element, done: () => void) => done())
    const data = ref({
      hasSlot: true,
      tag: 'div',
      text: 'first',
      onLeave,
      onEnter,
    })
    const Child = compile(
      `<template>
        <Transition
          mode="out-in"
          :css="false"
          @leave="data.onLeave"
          @enter="data.onEnter"
        >
          <slot />
        </Transition>
      </template>`,
      data,
    )
    const App = defineComponent({
      setup() {
        return () =>
          h(
            Child,
            null,
            data.value.hasSlot
              ? {
                  default: () => h(data.value.tag, data.value.text),
                }
              : undefined,
          )
      },
    })
    const { host } = defineInterop(App).render()

    data.value.tag = 'span'
    data.value.text = 'second'
    await nextTick()

    expect(onLeave).toHaveBeenCalledOnce()
    expect(host.querySelector('div')?.textContent).toBe('first')
    expect(host.querySelector('span')).toBeNull()

    data.value.tag = 'p'
    data.value.text = 'latest'
    await nextTick()
    leaveDone!()
    await nextTick()

    expect(host.querySelector('div')).toBeNull()
    expect(host.querySelector('span')).toBeNull()
    expect(host.querySelector('p')?.textContent).toBe('latest')
    expect(onEnter).toHaveBeenCalledOnce()

    finishLeaveSynchronously = true
    data.value.tag = 'div'
    data.value.text = 'sync'
    await nextTick()

    expect(onLeave).toHaveBeenCalledTimes(2)
    expect(host.querySelector('p')).toBeNull()
    expect(host.querySelector('div')?.textContent).toBe('sync')
    expect(onEnter).toHaveBeenCalledTimes(2)

    finishLeaveSynchronously = false
    data.value.tag = 'span'
    data.value.text = 'discarded'
    await nextTick()
    expect(onLeave).toHaveBeenCalledTimes(3)
    data.value.hasSlot = false
    await nextTick()
    leaveDone!()
    await nextTick()

    expect(host.querySelector('div')).toBeNull()
    expect(host.querySelector('span')).toBeNull()
    expect(onEnter).toHaveBeenCalledTimes(2)
  })

  test('vdom slot content should respect in-out transition mode', async () => {
    let enterDone: (() => void) | undefined
    let leaveDone: (() => void) | undefined
    const onEnter = vi.fn((_el: Element, done: () => void) => {
      enterDone = done
    })
    const onLeave = vi.fn((_el: Element, done: () => void) => {
      leaveDone = done
    })
    const data = ref({
      show: true,
      onEnter,
      onLeave,
    })
    const Child = compile(
      `<template>
        <Transition
          mode="in-out"
          :css="false"
          @enter="data.onEnter"
          @leave="data.onLeave"
        >
          <slot />
        </Transition>
      </template>`,
      data,
    )
    const App = compile(
      `<script setup>
        const data = _data
        const components = _components
      </script>
      <template>
        <components.Child>
          <div v-if="data.show">first</div>
          <span v-else>second</span>
        </components.Child>
      </template>`,
      data,
      { Child },
      { vapor: false },
    )
    const { host } = defineInterop(App as any).render()

    data.value.show = false
    await nextTick()

    expect(onEnter).toHaveBeenCalledOnce()
    expect(onLeave).not.toHaveBeenCalled()
    expect(host.querySelector('div')?.textContent).toBe('first')
    expect(host.querySelector('span')?.textContent).toBe('second')

    enterDone!()
    expect(onLeave).toHaveBeenCalledOnce()
    expect(host.querySelector('div')?.textContent).toBe('first')

    leaveDone!()
    await nextTick()

    expect(host.querySelector('div')).toBeNull()
    expect(host.querySelector('span')?.textContent).toBe('second')
  })

  test('teleport root should respect out-in transition mode', async () => {
    let leaveDone: (() => void) | undefined
    const target = document.createElement('div')
    const onEnter = vi.fn((_el: Element, done: () => void) => done())
    const onLeave = vi.fn((_el: Element, done: () => void) => {
      leaveDone = done
    })
    const data = ref({ show: true, target, onEnter, onLeave })
    const App = compile(
      `<template>
        <Transition
          mode="out-in"
          :css="false"
          @enter="data.onEnter"
          @leave="data.onLeave"
        >
          <template #default v-if="data.show">
            <Teleport :to="data.target"><div>A</div></Teleport>
          </template>
          <template #default v-else>
            <Teleport :to="data.target"><div>B</div></Teleport>
          </template>
        </Transition>
      </template>`,
      data,
    )
    const { app } = define(App).render()

    try {
      data.value.show = false
      await nextTick()

      expect(onLeave).toHaveBeenCalledOnce()
      expect(onEnter).not.toHaveBeenCalled()
      expect(target.textContent).toBe('A')

      leaveDone!()
      await nextTick()

      expect(onEnter).toHaveBeenCalledOnce()
      expect(target.textContent).toBe('B')
    } finally {
      leaveDone?.()
      app.unmount()
    }
  })

  test('disabled teleport should leave with its main-view owner', async () => {
    let leaveDone: (() => void) | undefined
    const target = document.createElement('div')
    const onLeave = vi.fn((_el: Element, done: () => void) => {
      leaveDone = done
    })
    const data = ref({ show: true, target, onLeave })
    const App = compile(
      `<template>
        <Transition :css="false" @leave="data.onLeave">
          <div v-if="data.show">
            <Teleport :to="data.target" disabled><span>A</span></Teleport>
          </div>
        </Transition>
      </template>`,
      data,
    )
    const { app, host } = define(App).render()

    try {
      data.value.show = false
      await nextTick()

      expect(onLeave).toHaveBeenCalledOnce()
      expect(host.textContent).toBe('A')

      leaveDone!()
      await nextTick()

      expect(host.textContent).toBe('')
    } finally {
      leaveDone?.()
      app.unmount()
    }
  })

  test('slot fallback should trigger enter hooks when slot content becomes empty', async () => {
    const onBeforeEnter = vi.fn()
    const onEnter = vi.fn()
    const data = ref({
      show: true,
      onBeforeEnter,
      onEnter,
    })
    const Child = compile(
      `<template>
        <Transition
          @before-enter="data.onBeforeEnter"
          @enter="data.onEnter"
        >
          <slot>
            <div>22</div>
          </slot>
        </Transition>
      </template>`,
      data,
    )
    const App = compile(
      `<template>
        <button @click="data.show = !data.show">Toggle</button>
        <components.Child>
          <div v-if="data.show">3</div>
        </components.Child>
      </template>`,
      data,
      { Child },
    )
    const { host } = define(App as any).render()

    host.querySelector('button')!.click()
    await nextTick()

    expect(host.innerHTML).toContain(
      '<div class="v-leave-from v-leave-active">3</div>',
    )
    expect(host.innerHTML).toContain(
      '<div class="v-enter-from v-enter-active">22</div>',
    )
    expect(onBeforeEnter).toHaveBeenCalledTimes(1)
    expect(onEnter).toHaveBeenCalledTimes(1)
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

  test('unkeyed component child should early-remove the previous leaving instance on rapid toggle', async () => {
    // Capture the leave `done` so the leave stays in progress while we toggle
    // back on, exercising the earlyRemove path.
    let leaveDone: (() => void) | undefined
    const data = ref({
      show: true,
      onLeave: (_: Element, done: () => void) => {
        leaveDone = done
      },
    })
    const Comp = compile(`<template><div class="c">comp</div></template>`, data)
    const App = compile(
      `<template>
        <Transition @leave="data.onLeave">
          <components.Comp v-if="data.show" />
        </Transition>
      </template>`,
      data,
      { Comp },
    )
    const { host } = define(App as any).render()
    expect(host.querySelectorAll('.c').length).toBe(1)

    // start leaving; the captured `done` holds the leave open
    data.value.show = false
    await nextTick()
    expect(host.querySelectorAll('.c').length).toBe(1)

    // Re-enter while the previous instance is still leaving. The new instance
    // has a different uid, but an unkeyed child must share the leaving-cache
    // bucket by resolved type so earlyRemove force-removes the previous one
    // instead of leaving both elements in the DOM.
    data.value.show = true
    await nextTick()
    expect(host.querySelectorAll('.c').length).toBe(1)

    // finishing the already early-removed leave must not strand a node
    leaveDone && leaveDone()
    await nextTick()
    expect(host.querySelectorAll('.c').length).toBe(1)
  })

  test('static single-element child should react to transition prop changes', async () => {
    const data = ref({ name: 'a', show: true })
    const App = compile(
      `<template>
        <Transition :name="data.name">
          <div v-show="data.show">foo</div>
        </Transition>
      </template>`,
      data,
    )
    const { host } = define(App as any).render()
    const el = host.querySelector('div')!

    // change the transition name reactively before any toggle
    data.value.name = 'b'
    await nextTick()

    // leaving should use the updated name, not the setup-time one
    data.value.show = false
    await nextTick()
    expect(el.className).toBe('b-leave-from b-leave-active')
  })

  // #15274
  test('should merge fallthrough class with a transition child root', async () => {
    const data = ref({
      internalClass: 'internal-box',
      externalClass: 'external-class',
    })
    const Child = compile(
      `<template>
        <Transition>
          <div class="box" :class="data.internalClass">child</div>
        </Transition>
      </template>`,
      data,
    )
    const App = compile(
      `<template>
        <components.Child :class="data.externalClass" />
      </template>`,
      data,
      { Child },
    )
    const { host } = define(App as any).render()
    const el = host.querySelector('div')!

    expect([...el.classList]).toEqual(
      expect.arrayContaining(['external-class', 'box', 'internal-box']),
    )
    expect(el.classList).toHaveLength(3)

    data.value.internalClass = 'internal-next'
    data.value.externalClass = 'external-next'
    await nextTick()

    expect([...el.classList]).toEqual(
      expect.arrayContaining(['external-next', 'box', 'internal-next']),
    )
    expect(el.classList).toHaveLength(3)
  })
})
