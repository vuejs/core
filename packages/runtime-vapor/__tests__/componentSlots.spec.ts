import {
  VaporTeleport,
  child,
  createComponent,
  createFor,
  createForSlots,
  createIf,
  createSlot,
  createVaporApp,
  createVaporSSRApp,
  defineVaporAsyncComponent,
  defineVaporComponent,
  insert,
  next,
  remove,
  renderEffect,
  setInsertionState,
  template,
  txt,
  vaporInteropPlugin,
} from '../src'
import {
  Comment,
  type Ref,
  createApp,
  createSlots,
  currentInstance,
  h,
  markRaw,
  nextTick,
  onScopeDispose,
  reactive,
  ref,
  renderSlot,
  shallowRef,
  toDisplayString,
  useSlots,
} from '@vue/runtime-dom'
import {
  NO,
  NOOP,
  VaporBlockShape,
  VaporIfFlags,
  VaporSlotFlags,
  VaporSlotStability,
  VaporVForFlags,
  extend,
  isString,
} from '@vue/shared'
import { compile, makeRender, renderParity, stripAnchors } from './_utils'
import type { DynamicSlot } from '../src/componentSlots'
import { setElementText, setText } from '../src/dom/prop'
import {
  type Block,
  type BlockFn,
  isValidBlock,
  isValidSlot,
} from '../src/block'
import {
  claimUntrackedAnchor,
  hydrateNode,
  isClaimedAnchor,
  setCurrentHydrationNode,
  setIsHydratingEnabled,
} from '../src/dom/hydration'
import {
  DynamicFragment,
  SlotFragment,
  isVaporSlotOutlet,
} from '../src/fragment'
import { IF } from '../src/fragmentFlags'
import { type SlotBoundaryContext, withSlotBoundary } from '../src/slotBoundary'
import { currentRenderContext } from '../src/renderContext'
import {
  type SlotResolutionState,
  markSlotResolutionDirty,
  recheckSlotResolution,
} from '../src/slotFragment'
import {
  hydrateDynamicFragmentAnchor,
  withHydratingSlotBoundary,
} from '../src/dom/hydrateFragment'

const define = makeRender<any>()
const keyedIfShape =
  VaporBlockShape.SINGLE_ROOT | (1 << VaporIfFlags.INDEX_SHIFT)
const slotRootIfShape = VaporBlockShape.SINGLE_ROOT | VaporIfFlags.SLOT_ROOT
const keyedSlotRootIfShape = keyedIfShape | VaporIfFlags.SLOT_ROOT
const slotRootForFlags = VaporVForFlags.SLOT_ROOT
const nonStableSlot = { _: VaporSlotStability.NON_STABLE } as const
const createForwardedSlotRoot = (name: string, fallback?: BlockFn) =>
  createSlot(name, null, fallback, VaporSlotFlags.FORWARDED)

function renderWithSlots(slots: any): any {
  let instance: any
  const Comp = defineVaporComponent({
    setup() {
      const t0 = template('<div></div>')
      const n0 = t0()
      instance = currentInstance
      return n0
    },
  })

  const { render } = define({
    render() {
      return createComponent(Comp, {}, slots)
    },
  })

  render()
  return instance
}

function createTestSlotResolutionState(options: {
  fallback?: BlockFn
  content?: Block
  parentNode?: ParentNode | null
  anchor?: Node | null
  isBusy?: () => boolean
  isContentValid?: () => boolean
  isDisposed?: () => boolean
}): SlotResolutionState {
  let state!: SlotResolutionState
  const boundary: SlotBoundaryContext = {
    getParent: () => null,
    getFallback: () => options.fallback,
    run: (fn, scope) => (scope ? scope.run(fn)! : fn()),
    markDirty: () => markSlotResolutionDirty(state),
    isHolding: NO,
    isHeld: NO,
  }
  state = {
    boundary,
    activeFallback: null,
    pendingRecheck: false,
    isReconciling: false,
    getContent: () => options.content || [],
    getParentNode: () => options.parentNode || null,
    getAnchor: () => options.anchor || null,
    isBusy: options.isBusy || (() => false),
    isDisposed: options.isDisposed || (() => false),
    isContentValid:
      options.isContentValid || (() => isValidSlot(options.content || [])),
    syncNodes: () => {},
    notifyExposedValidityChange: vi.fn(),
  }
  return state
}

describe('component: slots', () => {
  test('initSlots: instance.slots should be set correctly', () => {
    const { slots } = renderWithSlots({
      default: () => template('<span></span>')(),
    })

    expect(slots.default()).toMatchObject(document.createElement('span'))
  })

  test('updateSlots: instance.slots should be updated correctly', async () => {
    const flag1 = ref(true)

    let instance: any
    const Child = () => {
      instance = currentInstance
      return template('child')()
    }

    const { render } = define({
      render() {
        return createComponent(
          Child,
          {},
          {
            $: [
              () =>
                flag1.value
                  ? { name: 'one', fn: () => template('<span></span>')() }
                  : { name: 'two', fn: () => template('<div></div>')() },
            ],
          },
        )
      },
    })

    render()

    expect(instance.slots).toHaveProperty('one')
    expect(instance.slots).not.toHaveProperty('two')

    flag1.value = false
    await nextTick()

    expect(instance.slots).not.toHaveProperty('one')
    expect(instance.slots).toHaveProperty('two')
  })

  // passes but no warning for slot invocation in vapor currently
  test.todo('should not warn when mounting another app in setup', () => {
    const Comp = defineVaporComponent({
      setup(_, { slots }) {
        return slots.default!()
      },
    })
    const mountComp = () => {
      createVaporApp({
        render() {
          return createComponent(
            Comp,
            {},
            { default: () => template('msg')() },
          )!
        },
      })
    }
    const App = {
      setup() {
        mountComp()
        return []
      },
    }
    createVaporApp(App).mount(document.createElement('div'))
    expect(
      'Slot "default" invoked outside of the render function',
    ).not.toHaveBeenWarned()
  })

  test('should ignore key on <template v-slot> like vdom', async () => {
    const reused: boolean[] = []
    const { vdom, vapor } = await renderParity(
      {
        Child: `<template><div><slot>fallback</slot><slot name="foo" :x="1">fallback</slot></div></template>`,
        App: `<template><components.Child>
          <template #default :key="data.k"><input /></template>
          <template #foo="{ x }" :key="data.k">foo{{ x }}</template>
        </components.Child></template>`,
      },
      () => ref({ k: 1 }),
      async (data, root) => {
        const input = root.querySelector('input')
        data.value.k = 2
        await nextTick()
        reused.push(!!input && root.querySelector('input') === input)
      },
    )
    // the slot is rendered and patched in place, not remounted
    expect(reused).toEqual([true, true])
    expect(vapor.text).toBe(vdom.text)
  })

  test('should keep number literal slot props as numbers like vdom', async () => {
    const { vdom, vapor } = await renderParity(
      {
        Child: `<template><slot :count="0" :level="1" :ratio="1.5"/></template>`,
        App: `<template><components.Child v-slot="{ count, level, ratio }">{{ typeof count }}/{{ count + 1 }}/{{ count === 0 }}/{{ level === 1 }}/{{ ratio }}</components.Child></template>`,
      },
      () => ref(0),
      () => {},
    )
    expect(vdom.text).toBe('number/1/true/true/1.5')
    expect(vapor.text).toBe(vdom.text)
  })

  test('v-if / v-for slots override unconditional ones like vdom', async () => {
    const texts: Record<string, string[]> = {}
    await renderParity(
      {
        Child: `<template><div><slot name="a">fa</slot>|<slot name="b">fb</slot></div></template>`,
        App: `<template><components.Child>
          <template v-for="n in data.names" #[n]>forwarded {{ n }}</template>
          <template #a>own a</template>
          <template v-if="data.ok" #b>own b</template>
          <template #[data.name]>computed</template>
        </components.Child></template>`,
      },
      () => ref({ names: ['a'], ok: true, name: 'b' }),
      async (data, root, mode) => {
        const seen = [root.textContent!]
        data.value.names = []
        await nextTick()
        seen.push(root.textContent!)
        data.value.ok = false
        await nextTick()
        seen.push(root.textContent!)
        texts[mode] = seen
      },
    )
    expect(texts.vdom).toEqual([
      'forwarded a|own b',
      'own a|own b',
      'own a|computed',
    ])
    expect(texts.vapor).toEqual(texts.vdom)
  })

  describe('slot fallback boundary', () => {
    test('slot fragment insert uses active fallback output', () => {
      const container = document.createElement('div')
      const frag = new SlotFragment()

      frag.updateSlot(undefined, () => document.createTextNode('fallback'))

      insert(frag, container)

      expect(container.innerHTML).toBe('fallback<!--slot-->')
    })

    test('claimed structural anchors are not valid blocks', () => {
      // Prod anchors are text nodes; without the claim marker they read as
      // renderable content and suppress slot fallback in prod only.
      expect(
        isValidBlock(claimUntrackedAnchor(document.createTextNode(''))),
      ).toBe(false)
      expect(
        isValidSlot([[], claimUntrackedAnchor(document.createTextNode(''))]),
      ).toBe(false)
    })

    test('slot fragment validity uses active fallback output', () => {
      const frag = new SlotFragment()

      frag.updateSlot(undefined, () => document.createTextNode('fallback'))

      expect(isValidBlock(frag)).toBe(true)
    })

    test('slot root does not notify parent while exposed validity stays valid', () => {
      const markDirty = vi.fn()
      const parentBoundary: SlotBoundaryContext = {
        getParent: () => null,
        getFallback: () => undefined,
        run: fn => fn(),
        markDirty,
        isHolding: NO,
        isHeld: NO,
      }
      const frag = withSlotBoundary(
        parentBoundary,
        () => new SlotFragment(VaporSlotFlags.FORWARDED),
      )
      const fallback = () => document.createTextNode('fallback')

      frag.updateSlot(() => [], fallback)
      markDirty.mockClear()
      frag.updateSlot(() => document.createTextNode('content'), fallback)

      expect(markDirty).not.toHaveBeenCalled()
    })

    test('slot fragment remove cleans active fallback and fallback scope', () => {
      const container = document.createElement('div')
      const stop = vi.fn()
      const frag = new SlotFragment()
      frag.updateSlot(undefined, () => {
        onScopeDispose(stop)
        return document.createTextNode('fallback')
      })
      insert(frag, container)
      remove(frag, container)

      expect(Array.from(container.childNodes)).toEqual([])
      expect(stop).toHaveBeenCalledTimes(1)
    })

    test('slot fragment renders its local fallback, not the enclosing one', () => {
      const localFallback = vi.fn(() =>
        document.createTextNode('local fallback'),
      )
      const enclosingFallback = vi.fn(() =>
        document.createTextNode('enclosing fallback'),
      )
      const parentBoundary: SlotBoundaryContext = {
        getParent: () => null,
        getFallback: () => enclosingFallback,
        run: fn => fn(),
        markDirty: vi.fn(),
        isHolding: NO,
        isHeld: NO,
      }
      const frag = withSlotBoundary(
        parentBoundary,
        () => new SlotFragment(VaporSlotFlags.FORWARDED),
      )

      frag.updateSlot(undefined, localFallback)

      expect(frag.activeFallback).toBeInstanceOf(Text)
      expect((frag.activeFallback as Text).textContent).toBe('local fallback')
      expect(localFallback).toHaveBeenCalled()
      expect(enclosingFallback).not.toHaveBeenCalled()
    })

    test('forwarded slot root with an invalid local fallback exposes it, not the enclosing fallback', () => {
      const localFallback = vi.fn(() => [])
      const enclosingFallback = vi.fn(() =>
        document.createTextNode('enclosing fallback'),
      )
      const parentBoundary: SlotBoundaryContext = {
        getParent: () => null,
        getFallback: () => enclosingFallback,
        run: fn => fn(),
        markDirty: vi.fn(),
        isHolding: NO,
        isHeld: NO,
      }
      const frag = withSlotBoundary(
        parentBoundary,
        () => new SlotFragment(VaporSlotFlags.FORWARDED),
      )

      frag.updateSlot(undefined, localFallback)

      expect(isValidBlock(frag)).toBe(false)
      expect(localFallback).toHaveBeenCalled()
      expect(enclosingFallback).not.toHaveBeenCalled()
    })

    test('slot fragment local fallback renders nested slots against its own outlet only', () => {
      const enclosingFallback = vi.fn(() =>
        document.createTextNode('outer fallback'),
      )
      const parentBoundary: SlotBoundaryContext = {
        getParent: () => null,
        getFallback: () => enclosingFallback,
        run: (fn: () => any) => fn(),
        markDirty: vi.fn(),
        isHolding: NO,
        isHeld: NO,
      }
      const frag = withSlotBoundary(
        parentBoundary,
        () => new SlotFragment(VaporSlotFlags.FORWARDED),
      )
      let fallbackBoundary: any

      frag.updateSlot(undefined, () => {
        fallbackBoundary = currentRenderContext.slotBoundary
        return []
      })

      // The fallback body renders under a boundary of this outlet with no
      // parent: nested outlets never reach the enclosing outlet's fallback,
      // the outlet exposes its own invalidity to it instead.
      expect(fallbackBoundary).not.toBe(frag.boundary)
      expect(fallbackBoundary.getParent()).toBeNull()
      expect(enclosingFallback).not.toHaveBeenCalled()
      expect(isValidBlock(frag)).toBe(false)
    })

    test('slot fragment keeps an invalid local fallback and exposes its invalidity', () => {
      const container = document.createElement('div')
      const parentBoundary: SlotBoundaryContext = {
        getParent: () => null,
        getFallback: () => () => document.createTextNode('outer fallback'),
        run: (fn: () => any) => fn(),
        markDirty: vi.fn(),
        isHolding: NO,
        isHeld: NO,
      }
      const frag = withSlotBoundary(
        parentBoundary,
        () => new SlotFragment(VaporSlotFlags.FORWARDED),
      )
      let child!: DynamicFragment

      frag.updateSlot(undefined, () => {
        if (!child) {
          // a slot root, created under the fallback's boundary
          child = new DynamicFragment(IF, 'if', false, true)
          child.update(() => document.createTextNode('inner fallback'))
        }
        return child
      })
      insert(frag, container)

      expect(container.innerHTML).toBe('inner fallback<!--if--><!--slot-->')
      expect(isValidBlock(frag)).toBe(true)

      child.update(() => [])

      // the enclosing outlet renders its fallback from here, not this one
      expect(container.innerHTML).toBe('<!--if--><!--slot-->')
      expect(isValidBlock(frag)).toBe(false)
      expect(parentBoundary.markDirty).toHaveBeenCalled()
    })

    test('slot fragment local fallback ignores unrelated ancestor fallback refs', async () => {
      const ancestorText = ref('outer fallback')
      const localFallback = vi.fn(() =>
        document.createTextNode('local fallback'),
      )
      const container = document.createElement('div')
      const parentBoundary: SlotBoundaryContext = {
        getParent: () => null,
        getFallback: () => () => document.createTextNode(ancestorText.value),
        run: (fn: () => any) => fn(),
        markDirty: vi.fn(),
        isHolding: NO,
        isHeld: NO,
      }
      const frag = withSlotBoundary(parentBoundary, () => new SlotFragment())

      frag.updateSlot(undefined, localFallback)
      insert(frag, container)
      expect(container.innerHTML).toBe('local fallback<!--slot-->')
      expect(localFallback).toHaveBeenCalledTimes(1)

      ancestorText.value = 'updated outer fallback'
      await nextTick()

      expect(container.innerHTML).toBe('local fallback<!--slot-->')
      expect(localFallback).toHaveBeenCalledTimes(1)
    })

    test('compiled root v-if slot content toggles fallback with its anchor in place', async () => {
      const show = ref(false)
      const Child = compile(`<template><slot>fallback</slot></template>`, show)
      const App = compile(
        `<template>
          <components.Child>
            <template v-if="data">content</template>
          </components.Child>
        </template>`,
        show,
        { Child },
      )
      const root = document.createElement('div')
      const app = createVaporApp(App)
      app.mount(root)

      expect(root.innerHTML).toBe('<!--if-->fallback<!--slot-->')

      show.value = true
      await nextTick()

      expect(root.innerHTML).toBe('content<!--if--><!--slot-->')

      show.value = false
      await nextTick()

      expect(root.innerHTML).toBe('<!--if-->fallback<!--slot-->')

      show.value = true
      await nextTick()

      expect(root.innerHTML).toBe('content<!--if--><!--slot-->')
      app.unmount()
    })

    test('compiled root v-for slot content switches local fallback with its anchor in place', async () => {
      const items = ref<string[]>([])
      const Child = compile(`<template><slot>fallback</slot></template>`, items)
      const App = compile(
        `<template>
          <components.Child>
            <template v-for="item in data">
              {{ item }}
            </template>
          </components.Child>
        </template>`,
        items,
        { Child },
      )
      const root = document.createElement('div')
      const app = createVaporApp(App)
      app.mount(root)

      expect(root.innerHTML).toBe('<!--for-->fallback<!--slot-->')

      items.value = ['content']
      await nextTick()

      expect(root.innerHTML).toBe('content<!--for--><!--slot-->')
      app.unmount()
    })

    test('compiled root dynamic component slot content switches to fallback', async () => {
      const current = shallowRef<any>(() => document.createTextNode('content'))
      const Child = compile(
        `<template><slot>fallback</slot></template>`,
        current,
      )
      const App = compile(
        `<template>
          <components.Child>
            <component :is="data" />
          </components.Child>
        </template>`,
        current,
        { Child },
      )
      const root = document.createElement('div')
      const app = createVaporApp(App)
      app.mount(root)

      expect(root.innerHTML).toBe('content<!--dynamic-component--><!--slot-->')

      current.value = null
      await nextTick()

      expect(root.innerHTML).toBe('<!--dynamic-component-->fallback<!--slot-->')

      current.value = () => document.createTextNode('restored')
      await nextTick()

      expect(root.innerHTML).toBe('restored<!--dynamic-component--><!--slot-->')
      app.unmount()
    })

    test('compiled root v-for slot content with invalid branch switches fallback', async () => {
      const items = ref([{ text: 'bar', show: false }])
      const Child = compile(`<template><slot>fallback</slot></template>`, items)
      const App = compile(
        `<template>
          <components.Child>
            <template v-for="item in data" :key="item.text">
              <span v-if="item.show">{{ item.text }}</span>
            </template>
          </components.Child>
        </template>`,
        items,
        { Child },
      )
      const root = document.createElement('div')
      const app = createVaporApp(App)
      app.mount(root)

      expect(root.innerHTML).toBe('<!--if--><!--for-->fallback<!--slot-->')

      items.value[0].show = true
      await nextTick()

      expect(root.innerHTML).toBe(
        '<span>bar</span><!--if--><!--for--><!--slot-->',
      )

      items.value[0].show = false
      await nextTick()

      expect(root.innerHTML).toBe('<!--if--><!--for-->fallback<!--slot-->')
      app.unmount()
    })

    test('compiled slot fallback falls through and restores local root v-if fallback without keeping inactive anchor in DOM', async () => {
      const show = ref(false)
      const Outer = compile(
        `<template><slot>parent fallback</slot></template>`,
        show,
      )
      const Child = compile(
        `<template>
          <components.Outer>
            <slot>
              <span v-if="data">local fallback</span>
            </slot>
          </components.Outer>
        </template>`,
        show,
        { Outer },
      )
      const App = compile(
        `<template>
          <components.Child>
            <span v-if="false">content</span>
          </components.Child>
        </template>`,
        show,
        { Child },
      )
      const root = document.createElement('div')
      const app = createVaporApp(App)
      app.mount(root)

      expect(root.innerHTML).toBe(
        '<!--if--><!--if--><!--slot-->parent fallback<!--slot-->',
      )

      show.value = true
      await nextTick()

      expect(root.innerHTML).toBe(
        '<!--if--><span>local fallback</span><!--if--><!--slot--><!--slot-->',
      )

      show.value = false
      await nextTick()

      expect(root.innerHTML).toBe(
        '<!--if--><!--if--><!--slot-->parent fallback<!--slot-->',
      )
      app.unmount()
    })

    test('compiled slot keeps active fallback anchor when fallback becomes invalid without parent fallback', async () => {
      const show = ref(true)
      const Child = compile(
        `<template>
          <slot>
            <span v-if="data">fallback</span>
          </slot>
        </template>`,
        show,
      )
      const App = compile(
        `<template>
          <components.Child>
            <span v-if="false">content</span>
          </components.Child>
        </template>`,
        show,
        { Child },
      )
      const root = document.createElement('div')
      const app = createVaporApp(App)
      app.mount(root)

      expect(root.innerHTML).toBe(
        '<!--if--><span>fallback</span><!--if--><!--slot-->',
      )

      show.value = false
      await nextTick()

      expect(root.innerHTML).toBe('<!--if--><!--if--><!--slot-->')

      show.value = true
      await nextTick()

      expect(root.innerHTML).toBe(
        '<!--if--><span>fallback</span><!--if--><!--slot-->',
      )
      app.unmount()
    })

    test('compiled forwarded fallback preserves stable root when dynamic sibling becomes invalid', async () => {
      const show = ref(true)
      const Outer = compile(
        `<template><slot>parent fallback</slot></template>`,
        show,
      )
      const Child = compile(
        `<template>
          <components.Outer>
            <slot>
              <input value="stable">
              <span v-if="data">dynamic</span>
            </slot>
          </components.Outer>
        </template>`,
        show,
        { Outer },
      )
      const App = compile(
        `<template>
          <components.Child>
            <span v-if="false">content</span>
          </components.Child>
        </template>`,
        show,
        { Child },
      )
      const root = document.createElement('div')
      const app = createVaporApp(App)
      app.mount(root)

      expect(root.innerHTML).toBe(
        '<!--if--><input value="stable"><span>dynamic</span><!--if--><!--slot--><!--slot-->',
      )
      const input = root.querySelector('input')!
      input.value = 'typed'

      show.value = false
      await nextTick()

      expect(root.querySelector('input')).toBe(input)
      expect(input.value).toBe('typed')
      expect(root.innerHTML).toBe(
        '<!--if--><input value="stable"><!--if--><!--slot--><!--slot-->',
      )

      show.value = true
      await nextTick()

      expect(root.querySelector('input')).toBe(input)
      expect(input.value).toBe('typed')
      expect(root.innerHTML).toBe(
        '<!--if--><input value="stable"><span>dynamic</span><!--if--><!--slot--><!--slot-->',
      )
      app.unmount()
    })

    test('slot fallback falls through and restores local root v-if fallback without keeping inactive anchor in DOM', async () => {
      const container = document.createElement('div')
      const anchor = document.createComment('slot')
      const showLocal = ref(false)
      let state!: SlotResolutionState
      const parentBoundary: SlotBoundaryContext = {
        getParent: () => null,
        getFallback: () => () => document.createTextNode('parent fallback'),
        run: fn => fn(),
        markDirty: vi.fn(),
        isHolding: NO,
        isHeld: NO,
      }
      const boundary: SlotBoundaryContext = {
        getParent: () => parentBoundary,
        getFallback: () => () =>
          createIf(
            () => showLocal.value,
            () => document.createTextNode('local fallback'),
            undefined,
            keyedSlotRootIfShape,
          ),
        run: fn => fn(),
        markDirty: () => markSlotResolutionDirty(state),
        isHolding: NO,
        isHeld: NO,
      }
      state = {
        boundary,
        activeFallback: null,
        pendingRecheck: false,
        isReconciling: false,
        getContent: () => [],
        getParentNode: () => container,
        getAnchor: () => anchor,
        isBusy: () => false,
        isDisposed: () => false,
        isContentValid: () => false,
        syncNodes: () => {},
        notifyExposedValidityChange: vi.fn(),
      }

      container.append(anchor)
      recheckSlotResolution(state)

      expect(container.innerHTML).toBe('parent fallback<!--slot-->')

      showLocal.value = true
      await nextTick()

      expect(container.innerHTML).toBe('local fallback<!--if--><!--slot-->')
    })

    test('slot fallback falls through when local fallback is removed', () => {
      const container = document.createElement('div')
      const anchor = document.createComment('slot')
      let localFallback: BlockFn | undefined = () =>
        document.createTextNode('local fallback')
      let state!: SlotResolutionState
      const parentBoundary: SlotBoundaryContext = {
        getParent: () => null,
        getFallback: () => () => document.createTextNode('parent fallback'),
        run: fn => fn(),
        markDirty: vi.fn(),
        isHolding: NO,
        isHeld: NO,
      }
      const boundary: SlotBoundaryContext = {
        getParent: () => parentBoundary,
        getFallback: () => localFallback,
        run: fn => fn(),
        markDirty: () => markSlotResolutionDirty(state),
        isHolding: NO,
        isHeld: NO,
      }
      state = {
        boundary,
        activeFallback: null,
        pendingRecheck: false,
        isReconciling: false,
        getContent: () => [],
        getParentNode: () => container,
        getAnchor: () => anchor,
        isBusy: () => false,
        isDisposed: () => false,
        isContentValid: () => false,
        syncNodes: () => {},
        notifyExposedValidityChange: vi.fn(),
      }

      container.append(anchor)
      recheckSlotResolution(state)
      expect(container.innerHTML).toBe('local fallback<!--slot-->')

      localFallback = undefined
      state.fallbackChainStale = true
      recheckSlotResolution(state)
      expect(container.innerHTML).toBe('parent fallback<!--slot-->')
    })

    test('slot boundary dirtying ignores non-root v-if updates', async () => {
      const markDirty = vi.fn()
      const show = ref(true)
      const boundary: SlotBoundaryContext = {
        getParent: () => null,
        getFallback: () => undefined,
        run: fn => fn(),
        markDirty,
        isHolding: NO,
        isHeld: NO,
      }
      const Child = defineVaporComponent(() =>
        withSlotBoundary(boundary, () =>
          createIf(
            () => show.value,
            () => document.createTextNode('content'),
            undefined,
            keyedIfShape,
          ),
        ),
      )

      define(() => createComponent(Child)).render()
      show.value = false
      await nextTick()

      expect(markDirty).not.toHaveBeenCalled()
    })

    test('slot boundary dirtying ignores non-root v-for updates', async () => {
      const markDirty = vi.fn()
      const items = ref([1])
      const boundary: SlotBoundaryContext = {
        getParent: () => null,
        getFallback: () => undefined,
        run: fn => fn(),
        markDirty,
        isHolding: NO,
        isHeld: NO,
      }
      const Child = defineVaporComponent(() =>
        withSlotBoundary(boundary, () =>
          createFor(
            () => items.value,
            item => document.createTextNode(String(item.value)),
          ),
        ),
      )

      define(() => createComponent(Child)).render()
      items.value = []
      await nextTick()

      expect(markDirty).not.toHaveBeenCalled()
    })

    test('slot boundary dirtying tracks root v-if updates', async () => {
      const markDirty = vi.fn()
      const show = ref(true)
      const boundary: SlotBoundaryContext = {
        getParent: () => null,
        getFallback: () => undefined,
        run: fn => fn(),
        markDirty,
        isHolding: NO,
        isHeld: NO,
      }
      const Child = defineVaporComponent(() =>
        withSlotBoundary(boundary, () =>
          createIf(
            () => show.value,
            () => document.createTextNode('content'),
            undefined,
            keyedSlotRootIfShape,
          ),
        ),
      )

      define(() => createComponent(Child)).render()
      show.value = false
      await nextTick()

      expect(markDirty).toHaveBeenCalledTimes(1)

      show.value = true
      await nextTick()

      expect(markDirty).toHaveBeenCalledTimes(2)
    })

    test('slot boundary dirtying ignores adopted v-if initial mount', async () => {
      const markDirty = vi.fn()
      const show = ref(true)
      const boundary: SlotBoundaryContext = {
        getParent: () => null,
        getFallback: () => undefined,
        run: fn => fn(),
        markDirty,
        isHolding: NO,
        isHeld: NO,
      }
      const Child = defineVaporComponent(() => {
        const n = template('<div><!></div>', 1)() as any
        setInsertionState(n, child(n))
        withSlotBoundary(boundary, () =>
          createIf(
            () => show.value,
            () => document.createTextNode('content'),
            undefined,
            slotRootIfShape,
          ),
        )
        return n
      })

      const { host } = define(() => createComponent(Child)).render()

      expect(host.innerHTML).toBe('<div>content<!--if--></div>')
      expect(markDirty).not.toHaveBeenCalled()

      show.value = false
      await nextTick()

      expect(host.innerHTML).toBe('<div><!--if--></div>')
      expect(markDirty).toHaveBeenCalledTimes(1)
    })

    test('slot boundary dirtying tracks root v-for updates', async () => {
      const markDirty = vi.fn()
      const items = ref([1])
      const boundary: SlotBoundaryContext = {
        getParent: () => null,
        getFallback: () => undefined,
        run: fn => fn(),
        markDirty,
        isHolding: NO,
        isHeld: NO,
      }
      const Child = defineVaporComponent(() =>
        withSlotBoundary(boundary, () =>
          createFor(
            () => items.value,
            item => document.createTextNode(String(item.value)),
            undefined,
            slotRootForFlags,
          ),
        ),
      )

      define(() => createComponent(Child)).render()
      items.value = []
      await nextTick()

      expect(markDirty).toHaveBeenCalledTimes(1)

      items.value = [1]
      await nextTick()

      expect(markDirty).toHaveBeenCalledTimes(2)
    })

    test('root vapor slot validity change dirties parent boundary', async () => {
      const markDirty = vi.fn()
      const show = ref(true)
      const boundary: SlotBoundaryContext = {
        getParent: () => null,
        getFallback: () => undefined,
        run: fn => fn(),
        markDirty,
        isHolding: NO,
        isHeld: NO,
      }
      const Child = defineVaporComponent(() =>
        withSlotBoundary(boundary, () => createForwardedSlotRoot('default')),
      )

      define(() =>
        createComponent(Child, null, {
          $: [
            () =>
              show.value
                ? {
                    name: 'default',
                    fn: () => document.createTextNode('content'),
                  }
                : {
                    name: 'default',
                    fn: () => [],
                  },
          ],
        }),
      ).render()
      markDirty.mockClear()

      show.value = false
      await nextTick()

      expect(markDirty).toHaveBeenCalledTimes(1)

      show.value = true
      await nextTick()

      expect(markDirty).toHaveBeenCalledTimes(2)
    })

    test('slot resolution state ignores dirty notifications after dispose', () => {
      let disposed = false
      const state = createTestSlotResolutionState({
        isDisposed: () => disposed,
      })

      disposed = true
      state.boundary.markDirty()

      expect(state.pendingRecheck).toBe(false)
    })

    test('removed slot fragment ignores queued resolution dirty notifications', () => {
      const container = document.createElement('div')
      const fallbackRuns = vi.fn()
      const cleanup = vi.fn()
      const frag = new SlotFragment()
      frag.updateSlot(undefined, () => {
        fallbackRuns()
        onScopeDispose(cleanup)
        return document.createTextNode('fallback')
      })
      insert(frag, container)
      expect(container.innerHTML).toBe('fallback<!--slot-->')
      expect(fallbackRuns).toHaveBeenCalledTimes(1)

      remove(frag, container)
      expect(container.innerHTML).toBe('')
      expect(cleanup).toHaveBeenCalledTimes(1)

      frag.boundary.markDirty()

      expect(fallbackRuns).toHaveBeenCalledTimes(1)
      expect(frag.activeFallback).toBe(null)
      expect(cleanup).toHaveBeenCalledTimes(1)
    })

    test('empty slot hydration does not clean following sibling', async () => {
      const start = document.createComment('[')
      const end = document.createComment(']')
      const footer = document.createElement('footer')
      footer.textContent = 'footer'
      const host = document.createElement('div')
      host.append(start, end, footer)
      let frag!: SlotFragment

      setIsHydratingEnabled(true)
      try {
        hydrateNode(start, () => {
          withHydratingSlotBoundary(() => {
            frag = new SlotFragment()
            setCurrentHydrationNode(footer)
            hydrateDynamicFragmentAnchor(frag, true)
          })
        })
      } finally {
        setIsHydratingEnabled(false)
      }
      await nextTick()

      expect(host.innerHTML).toBe('<!--[--><!--]--><footer>footer</footer>')
      expect(frag.anchor).toBe(end)
      expect(isClaimedAnchor(end)).toBe(true)
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()
    })

    test('empty slot hydration reuses its close anchor', () => {
      const start = document.createComment('[')
      const end = document.createComment(']')
      const host = document.createElement('div')
      host.append(start, end)
      let frag!: SlotFragment

      setIsHydratingEnabled(true)
      try {
        hydrateNode(start, () => {
          withHydratingSlotBoundary(() => {
            frag = new SlotFragment()
            hydrateDynamicFragmentAnchor(frag, true)
          })
        })
      } finally {
        setIsHydratingEnabled(false)
      }

      expect(frag.anchor).toBe(end)
      expect(isClaimedAnchor(end)).toBe(true)
    })

    test('non-forwarded empty slot hydration cleans stale content before close anchor', () => {
      const start = document.createComment('[')
      const stale = document.createElement('span')
      stale.textContent = 'stale'
      const end = document.createComment(']')
      const footer = document.createElement('footer')
      footer.textContent = 'footer'
      const host = document.createElement('div')
      host.append(start, stale, end, footer)
      let frag!: SlotFragment

      setIsHydratingEnabled(true)
      try {
        hydrateNode(start, () => {
          withHydratingSlotBoundary(() => {
            frag = new SlotFragment()
            hydrateDynamicFragmentAnchor(frag, true)
          })
        })
      } finally {
        setIsHydratingEnabled(false)
      }

      expect(host.innerHTML).toBe('<!--[--><!--]--><footer>footer</footer>')
      expect(frag.anchor).toBe(end)
      expect(isClaimedAnchor(end)).toBe(true)
      expect(`Hydration children mismatch`).toHaveBeenWarned()
    })

    test('slot resolution state stops fallback scope when fallback body throws', async () => {
      const source = ref(0)
      const effectRuns = vi.fn()
      const cleanup = vi.fn()
      const err = new Error('fallback boom')

      const state = createTestSlotResolutionState({
        fallback: () => {
          onScopeDispose(cleanup)
          renderEffect(() => {
            effectRuns(source.value)
          })
          throw err
        },
      })

      expect(() => recheckSlotResolution(state)).toThrow(err)
      expect(state.activeFallback).toBe(null)
      expect(cleanup).toHaveBeenCalledTimes(1)
      expect(effectRuns).toHaveBeenCalledTimes(1)

      source.value++
      await nextTick()

      expect(effectRuns).toHaveBeenCalledTimes(1)
    })

    test('slot resolution state rechecks when idle', () => {
      const fallback = document.createTextNode('fallback')
      const state = createTestSlotResolutionState({
        fallback: () => fallback,
      })

      state.boundary.markDirty()

      expect(state.activeFallback).toBe(fallback)
    })

    test('vdom slot does not dirty parent boundary when content stays valid', async () => {
      const text = ref('A')
      const boundary = {
        getParent: () => null,
        getFallback: () => undefined,
        run: (fn: () => any) => fn(),
        markDirty: vi.fn(),
        isHolding: NO,
        isHeld: NO,
      }
      const instance = renderWithSlots({})
      const app = createApp({ render: () => null })
      app.use(vaporInteropPlugin)
      const vdom = (app._context as any).vdom
      const slotsRef = shallowRef({
        default: () => [h('div', text.value)],
      })
      const frag = withSlotBoundary(boundary, () =>
        vdom.slot(slotsRef, 'default', {}, instance, {
          flags: VaporSlotFlags.FORWARDED,
        }),
      )
      const host = document.createElement('div')

      insert(frag, host)
      boundary.markDirty.mockClear()

      text.value = 'B'
      await nextTick()

      expect(host.innerHTML).toContain('<div>B</div>')
      expect(boundary.markDirty).not.toHaveBeenCalled()
    })

    test('vdom slot ignores non-root updates inside slot boundary', async () => {
      const text = ref('A')
      const boundary = {
        getParent: () => null,
        getFallback: () => undefined,
        run: (fn: () => any) => fn(),
        markDirty: vi.fn(),
        isHolding: NO,
        isHeld: NO,
      }
      const instance = renderWithSlots({})
      const app = createApp({ render: () => null })
      app.use(vaporInteropPlugin)
      const vdom = (app._context as any).vdom
      const slotsRef = shallowRef({
        default: () => [h('div', text.value)],
      })
      const frag = withSlotBoundary(boundary, () =>
        vdom.slot(slotsRef, 'default', {}, instance),
      )
      const host = document.createElement('div')

      insert(frag, host)
      boundary.markDirty.mockClear()

      text.value = 'B'
      await nextTick()

      expect(host.innerHTML).toContain('<div>B</div>')
      expect(boundary.markDirty).not.toHaveBeenCalled()
    })

    test('vdom slot does not dirty parent boundary when local fallback keeps output valid', async () => {
      const show = ref(true)
      const boundary = {
        getParent: () => null,
        getFallback: () => undefined,
        run: (fn: () => any) => fn(),
        markDirty: vi.fn(),
        isHolding: NO,
        isHeld: NO,
      }
      const instance = renderWithSlots({})
      const app = createApp({ render: () => null })
      app.use(vaporInteropPlugin)
      const vdom = (app._context as any).vdom
      const slotsRef = shallowRef({
        default: () => (show.value ? [h('div', 'content')] : []),
      })
      const frag = withSlotBoundary(boundary, () =>
        vdom.slot(slotsRef, 'default', {}, instance, {
          fallback: () => template('fallback')(),
          flags: VaporSlotFlags.FORWARDED,
        }),
      )
      const host = document.createElement('div')

      insert(frag, host)
      boundary.markDirty.mockClear()

      show.value = false
      await nextTick()

      expect(host.innerHTML).toBe('fallback')
      expect(boundary.markDirty).not.toHaveBeenCalled()
    })

    test('compiled vdom slot keeps invalid content in place while fallback is active', async () => {
      const showContent = ref(true)
      const showChild = ref(true)
      const Child = compile(
        `<template>
          <slot>
            <span>fallback</span>
          </slot>
        </template>`,
        showContent,
      )
      const App = {
        setup() {
          return () =>
            showChild.value
              ? h(Child as any, null, {
                  default: () => (showContent.value ? h('div', 'content') : []),
                })
              : null
        },
      }
      const root = document.createElement('div')
      const app = createApp(App).use(vaporInteropPlugin)
      app.mount(root)

      expect(root.innerHTML).toBe('<div>content</div>')

      showContent.value = false
      await nextTick()
      expect(root.innerHTML).toBe('<span>fallback</span>')

      showChild.value = false
      await nextTick()
      expect(root.innerHTML).toBe('<!---->')

      app.unmount()
    })

    test('compiled vdom slot keeps fallback when slots source is removed', async () => {
      const showContent = ref(true)
      const passSlot = ref(true)
      const Child = compile(
        `<template>
          <slot>
            <span>fallback</span>
          </slot>
        </template>`,
        showContent,
      )
      const App = {
        setup() {
          return () =>
            h(
              Child as any,
              null,
              passSlot.value
                ? {
                    default: () =>
                      showContent.value ? h('div', 'content') : [],
                  }
                : undefined,
            )
        },
      }
      const root = document.createElement('div')
      const app = createApp(App).use(vaporInteropPlugin)
      app.mount(root)

      expect(root.innerHTML).toBe('<div>content</div>')

      showContent.value = false
      await nextTick()
      expect(root.innerHTML).toBe('<span>fallback</span>')

      passSlot.value = false
      await nextTick()
      expect(root.innerHTML).toBe('<span>fallback</span>')

      app.unmount()
    })

    test('vdom slot patches invalid updates in place while fallback is active', async () => {
      const data = ref('first')
      const Child = compile(
        `<template><slot><span>fallback</span></slot></template>`,
        data,
      )
      const App = {
        setup() {
          return () =>
            h(Child, null, {
              default: () => [
                data.value === 'first'
                  ? h(Comment, 'first')
                  : h(Comment, 'second'),
              ],
            })
        },
      }
      const root = document.createElement('div')
      const app = createApp(App).use(vaporInteropPlugin)
      const childNodes = () =>
        Array.from(root.childNodes).map(node =>
          node.nodeType === 3
            ? `text:${JSON.stringify(node.textContent)}`
            : node.nodeType === 8
              ? `comment:${(node as Comment).data}`
              : (node as Element).outerHTML,
        )
      app.mount(root)

      expect(root.innerHTML).toBe('<span>fallback</span>')
      const fallbackNodes = [
        'text:""', // the invalid vdom content's fragment, in place
        'text:""',
        '<span>fallback</span>',
        'text:""', // VDOM slot host
        'text:""', // receiver slot
      ]
      expect(childNodes()).toEqual(fallbackNodes)

      data.value = 'second'
      await nextTick()

      // patched in place
      expect(childNodes()).toEqual(fallbackNodes)
      expect(root.innerHTML).toBe('<span>fallback</span>')
      app.unmount()
    })

    test('compiled slot does not reinsert active fallback while content stays invalid', async () => {
      const data = ref('first')
      const Child = compile(
        `<template><slot><span>fallback</span></slot></template>`,
        data,
      )
      const Parent = compile(
        `<script setup>
          const data = _data
          const components = _components
        </script>
        <template>
          <components.Child>
            <template v-if="data === 'first'" #default>
              <div v-if="data === 'first-valid'">first</div>
            </template>
            <template v-else #default>
              <p v-if="data === 'second-valid'">second</p>
            </template>
          </components.Child>
        </template>`,
        data,
        { Child },
      )
      const root = document.createElement('div')
      const app = createVaporApp(Parent)
      app.mount(root)

      const fallback = root.querySelector('span')!
      const insertBefore = vi.spyOn(Node.prototype, 'insertBefore')

      data.value = 'second'
      await nextTick()

      expect(root.innerHTML).toContain('<span>fallback</span>')
      expect(insertBefore.mock.calls.some(([node]) => node === fallback)).toBe(
        false,
      )

      insertBefore.mockRestore()
      app.unmount()
    })

    test('compiled forwarded slot fallback validity re-resolves the enclosing fallback', async () => {
      const data = ref(false)
      const Child = compile(
        `<template><slot><span>child fallback</span></slot></template>`,
        data,
      )
      const Parent = compile(
        `<template>
          <components.Child>
            <slot>
              <span v-if="data">parent fallback</span>
            </slot>
          </components.Child>
        </template>`,
        data,
        { Child },
      )
      const App = compile(
        `<template>
          <components.Parent>
            <span v-if="data && false">content</span>
          </components.Parent>
        </template>`,
        data,
        { Parent },
      )
      const root = document.createElement('div')
      const app = createVaporApp(App)
      app.mount(root)

      expect(root.innerHTML).toBe(
        '<!--if--><!--if--><!--slot--><span>child fallback</span><!--slot-->',
      )

      data.value = true
      await nextTick()

      expect(root.innerHTML).toBe(
        '<!--if--><span>parent fallback</span><!--if--><!--slot--><!--slot-->',
      )

      app.unmount()
    })

    test('propagates root forwarded slot exposed validity', async () => {
      const data = ref(true)
      const Outer = compile(
        `<template><slot><span>outer fallback</span></slot></template>`,
        data,
      )
      const Parent = compile(
        `<template>
          <components.Outer>
            <slot>
              <span v-if="data">forwarded fallback</span>
            </slot>
          </components.Outer>
        </template>`,
        data,
        { Outer },
      )
      const App = compile(
        `<template>
          <components.Parent>
            <span v-if="false">content</span>
          </components.Parent>
        </template>`,
        data,
        { Parent },
      )
      const root = document.createElement('div')
      const app = createVaporApp(App)
      app.mount(root)

      expect(root.innerHTML).toContain('<span>forwarded fallback</span>')
      expect(root.innerHTML).not.toContain('outer fallback')

      data.value = false
      await nextTick()

      expect(root.innerHTML).toContain('<span>outer fallback</span>')
      expect(root.innerHTML).not.toContain('forwarded fallback')

      app.unmount()
    })

    test('updates fallback body DOM without dirtying parent slot content', async () => {
      const data = ref(false)
      const Outer = compile(
        `<template><slot><span>outer fallback</span></slot></template>`,
        data,
      )
      const Child = compile(
        `<template>
          <slot>
            <span>child fallback<i v-if="data"> detail</i></span>
          </slot>
        </template>`,
        data,
      )
      const App = compile(
        `<template>
          <components.Outer>
            <components.Child>
              <span v-if="false">content</span>
            </components.Child>
          </components.Outer>
        </template>`,
        data,
        { Outer, Child },
      )
      const root = document.createElement('div')
      const app = createVaporApp(App)
      app.mount(root)

      expect(root.innerHTML).toContain('child fallback')
      expect(root.innerHTML).not.toContain('outer fallback')
      expect(root.innerHTML).not.toContain('<i>')

      data.value = true
      await nextTick()

      expect(root.innerHTML).toContain('child fallback')
      expect(root.innerHTML).toContain('<i> detail</i>')
      expect(root.innerHTML).not.toContain('outer fallback')

      app.unmount()
    })

    test('vdom slot dirties parent boundary when content validity changes', async () => {
      const show = ref(true)
      const boundary = {
        getParent: () => null,
        getFallback: () => undefined,
        run: (fn: () => any) => fn(),
        markDirty: vi.fn(),
        isHolding: NO,
        isHeld: NO,
      }
      const instance = renderWithSlots({})
      const app = createApp({ render: () => null })
      app.use(vaporInteropPlugin)
      const vdom = (app._context as any).vdom
      const slotsRef = shallowRef({
        default: () => (show.value ? [h('div', 'content')] : []),
      })
      const frag = withSlotBoundary(boundary, () =>
        vdom.slot(slotsRef, 'default', {}, instance, {
          flags: VaporSlotFlags.FORWARDED,
        }),
      )
      const host = document.createElement('div')

      insert(frag, host)
      boundary.markDirty.mockClear()

      show.value = false
      await nextTick()

      expect(host.innerHTML).toBe('')
      expect(boundary.markDirty).toHaveBeenCalledTimes(1)

      show.value = true
      await nextTick()

      expect(host.innerHTML).toContain('<div>content</div>')
      expect(boundary.markDirty).toHaveBeenCalledTimes(2)
    })

    test('vdom slot without flags or fallback renders content outside the boundary chain', () => {
      // Mirror of the vapor fast path: an outlet that joins no fallback
      // arbitration must not interpose its own dead-end boundary, so nested
      // outlets classify identically under both hosts. Hand-written: needs
      // to observe the ambient boundary from inside the slot function.
      let observedBoundary: SlotBoundaryContext | null | undefined
      const instance = renderWithSlots({})
      const app = createApp({ render: () => null })
      app.use(vaporInteropPlugin)
      const vdom = (app._context as any).vdom
      const slotsRef = shallowRef({
        default: () => {
          observedBoundary = currentRenderContext.slotBoundary
          return [h('div', 'content')]
        },
      })
      const frag = vdom.slot(slotsRef, 'default', {}, instance, {})
      const host = document.createElement('div')
      insert(frag, host)

      expect(observedBoundary).toBe(null)
      expect(host.innerHTML).toContain('<div>content</div>')

      // An arbitrating outlet keeps its own boundary around content.
      const fragWithFallback = vdom.slot(slotsRef, 'default', {}, instance, {
        fallback: () => template('fallback')(),
      })
      insert(fragWithFallback, host)
      expect(observedBoundary).not.toBe(null)
    })

    test('compiled vdom slot propagates nested fallback validity changes', async () => {
      const show = ref(true)
      const Receiver = compile(
        `<template><slot><span>outer fallback</span></slot></template>`,
        show,
      )
      const Bridge = compile(
        `<template>
          <components.Receiver>
            <slot>
              <span v-if="data">inner fallback</span>
            </slot>
          </components.Receiver>
        </template>`,
        show,
        { Receiver },
      )
      const App = compile(
        `<template>
          <components.Bridge>
            <span v-if="false">content</span>
          </components.Bridge>
        </template>`,
        show,
        { Bridge },
        { vapor: false },
      )
      const root = document.createElement('div')
      const app = createApp(App).use(vaporInteropPlugin)
      app.mount(root)

      expect(root.innerHTML).toBe(
        '<!--if--><span>inner fallback</span><!--if--><!--slot--><!--slot-->',
      )

      show.value = false
      await nextTick()

      expect(root.innerHTML).toBe(
        '<!--if--><!--if--><!--slot--><span>outer fallback</span><!--slot-->',
      )

      show.value = true
      await nextTick()

      expect(root.innerHTML).toBe(
        '<!--if--><span>inner fallback</span><!--if--><!--slot--><!--slot-->',
      )
      app.unmount()
    })

    test('compiled vdom slot still renders vapor fallback when slot content resolves empty', () => {
      const data = ref(false)
      const Child = compile(
        `<template><slot>child fallback</slot></template>`,
        data,
      )
      const App = compile(
        `<template>
          <components.Child>
            <span v-if="data">content</span>
          </components.Child>
        </template>`,
        data,
        { Child },
        { vapor: false },
      )
      const root = document.createElement('div')

      createApp(App).use(vaporInteropPlugin).mount(root)

      expect(root.innerHTML).toBe('<!--if-->child fallback<!--slot-->')
    })

    test('multiple forwarded roots resolve receiver fallback once', async () => {
      const data = ref({ showA: false, showB: false })
      const components: Record<string, any> = {}
      components.Receiver = compile(
        `<template><slot><span>fallback</span></slot></template>`,
        data,
        components,
      )
      components.Carrier = compile(
        `<script setup vapor>const components = _components</script>
        <template>
          <components.Receiver>
            <slot name="a" />
            <slot name="b" />
          </components.Receiver>
        </template>`,
        data,
        components,
      )
      const App = compile(
        `<script setup vapor>
        const components = _components
        const data = _data
        </script>
        <template>
          <components.Carrier>
            <template #a><span v-if="data.showA">A</span></template>
            <template #b><span v-if="data.showB">B</span></template>
          </components.Carrier>
        </template>`,
        data,
        components,
      )

      const { host } = define(App).render()

      expect(host.textContent).toBe('fallback')
      expect(host.innerHTML).toBe(
        '<!--if--><!--slot--><!--if--><!--slot--><span>fallback</span><!--slot-->',
      )

      data.value.showA = true
      await nextTick()
      expect(host.textContent).toBe('A')

      data.value.showA = false
      data.value.showB = true
      await nextTick()
      expect(host.textContent).toBe('B')

      data.value.showA = true
      await nextTick()
      expect(host.textContent).toBe('AB')

      data.value.showA = false
      data.value.showB = false
      await nextTick()
      expect(host.textContent).toBe('fallback')
      expect(host.innerHTML).toBe(
        '<!--if--><!--slot--><!--if--><!--slot--><span>fallback</span><!--slot-->',
      )
    })

    test('invalid static content stays in place beside the fallback', async () => {
      const data = ref({ mount: true, show: true })
      const components: Record<string, any> = {}
      components.Receiver = compile(
        `<template><slot><span>fallback</span></slot></template>`,
        data,
        components,
      )
      components.Carrier = compile(
        `<script setup vapor>
        const components = _components
        const data = _data
        </script>
        <template>
          <components.Receiver>
            <!--sentinel--><span v-if="data.show">content</span>
          </components.Receiver>
        </template>`,
        data,
        components,
      )
      const App = compile(
        `<script setup vapor>
        const components = _components
        const data = _data
        </script>
        <template><components.Carrier v-if="data.mount" /></template>`,
        data,
        components,
      )
      const root = document.createElement('div')
      const app = createVaporApp(App)
      app.mount(root)

      expect(root.textContent).toBe('content')

      data.value.show = false
      await nextTick()
      expect(root.textContent).toBe('fallback')
      expect(root.innerHTML).toContain('<!--sentinel-->')

      data.value.mount = false
      await nextTick()
      expect(root.textContent).toBe('')
      expect(root.childNodes).toHaveLength(1)
      app.unmount()
      expect(root.childNodes).toHaveLength(0)
    })

    test('nested fallbacks do not cross a shared fallback boundary', () => {
      const data = ref({})
      const components: Record<string, any> = {}
      components.Receiver = compile(
        `<template><slot><span>receiver fallback</span></slot></template>`,
        data,
        components,
      )
      components.Carrier = compile(
        `<script setup vapor>const components = _components</script>
        <template>
          <components.Receiver>
            <slot name="a"><slot name="x" /></slot>
            <slot name="b"><slot name="y" /></slot>
          </components.Receiver>
        </template>`,
        data,
        components,
      )
      const App = compile(
        `<script setup vapor>const components = _components</script>
        <template><components.Carrier /></template>`,
        data,
        components,
      )

      const { host } = define(App).render()

      expect(host.textContent).toBe('receiver fallback')
    })

    test('nested vdom fallbacks do not cross a shared fallback boundary', () => {
      const data = ref({})
      const components: Record<string, any> = {}
      components.Receiver = compile(
        `<template><slot><span>receiver fallback</span></slot></template>`,
        data,
        components,
      )
      components.Carrier = compile(
        `<script setup vapor>const components = _components</script>
        <template>
          <components.Receiver>
            <slot name="a"><slot name="x" /></slot>
            <slot name="b"><slot name="y" /></slot>
          </components.Receiver>
        </template>`,
        data,
        components,
      )
      const App = compile(
        `<script setup>const components = _components</script>
        <template><components.Carrier /></template>`,
        data,
        components,
        { vapor: false },
      )
      const root = document.createElement('div')
      const app = createApp(App).use(vaporInteropPlugin)

      app.mount(root)

      expect(root.textContent).toBe('receiver fallback')
      app.unmount()
    })

    test.each([
      ['vapor', true],
      ['vdom', false],
    ])(
      'shared local fallback preserves nested %s slot hosts',
      async (_, vapor) => {
        const data = ref({ showX: true, showY: false })
        const components: Record<string, any> = {}
        components.Receiver = compile(
          `<template><slot><span>receiver fallback</span></slot></template>`,
          data,
          components,
        )
        components.Carrier = compile(
          `<script setup vapor>const components = _components</script>
        <template>
          <components.Receiver>
            <slot name="a"><slot name="x" /><slot name="y" /></slot>
            <slot name="b" />
          </components.Receiver>
        </template>`,
          data,
          components,
        )
        const App = compile(
          `<script setup>const components = _components; const data = _data</script>
        <template>
          <components.Carrier>
            <template #x><span v-if="data.showX">X</span></template>
            <template #y><span v-if="data.showY">Y</span></template>
          </components.Carrier>
        </template>`,
          data,
          components,
          { vapor },
        )
        const root = document.createElement('div')
        const app = vapor
          ? createVaporApp(App)
          : createApp(App).use(vaporInteropPlugin)

        app.mount(root)
        expect(root.textContent).toBe('X')

        data.value.showX = false
        await nextTick()
        expect(root.textContent).toBe('receiver fallback')

        data.value.showY = true
        await nextTick()
        expect(root.textContent).toBe('Y')

        app.unmount()
      },
    )

    test('forwarded root shares receiver fallback with a dynamic sibling', async () => {
      const data = ref({ showSlot: false, showSibling: false })
      const components: Record<string, any> = {}
      components.Receiver = compile(
        `<template><slot><span>fallback</span></slot></template>`,
        data,
        components,
      )
      components.Carrier = compile(
        `<script setup vapor>
        const components = _components
        const data = _data
        </script>
        <template>
          <components.Receiver>
            <slot />
            <span v-if="data.showSibling">sibling</span>
          </components.Receiver>
        </template>`,
        data,
        components,
      )
      const App = compile(
        `<script setup vapor>
        const components = _components
        const data = _data
        </script>
        <template>
          <components.Carrier>
            <span v-if="data.showSlot">slot</span>
          </components.Carrier>
        </template>`,
        data,
        components,
      )

      const { host } = define(App).render()

      expect(host.textContent).toBe('fallback')

      data.value.showSibling = true
      await nextTick()
      expect(host.textContent).toBe('sibling')

      data.value.showSlot = true
      await nextTick()
      expect(host.textContent).toBe('slotsibling')

      data.value.showSlot = false
      data.value.showSibling = false
      await nextTick()
      expect(host.textContent).toBe('fallback')
    })

    test('v-once forwarded root shares receiver fallback with a sibling', async () => {
      const data = ref(false)
      const components: Record<string, any> = {}
      components.Receiver = compile(
        `<template><slot><span>fallback</span></slot></template>`,
        data,
        components,
      )
      components.Carrier = compile(
        `<script setup vapor>const components = _components</script>
        <template>
          <components.Receiver>
            <slot v-once name="a" />
            <slot name="b" />
          </components.Receiver>
        </template>`,
        data,
        components,
      )
      const appSource = `<script setup>
        const components = _components
        const data = _data
        </script>
        <template>
          <components.Carrier>
            <template #a><span v-if="false">A</span></template>
            <template #b><span v-if="data">B</span></template>
          </components.Carrier>
        </template>`
      const App = compile(appSource, data, components)

      const { host } = define(App).render()

      expect(host.textContent).toBe('fallback')

      data.value = true
      await nextTick()
      expect(host.textContent).toBe('B')

      data.value = false
      const VDOMApp = compile(appSource, data, components, { vapor: false })
      const root = document.createElement('div')
      const app = createApp(VDOMApp).use(vaporInteropPlugin)
      app.mount(root)

      expect(root.textContent).toBe('fallback')

      data.value = true
      await nextTick()
      expect(root.textContent).toBe('B')
      app.unmount()
    })

    test('multiple forwarded roots from vdom resolve receiver fallback once', async () => {
      const data = ref({ showA: false, showB: false })
      const components: Record<string, any> = {}
      components.Receiver = compile(
        `<template><slot><span>fallback</span></slot></template>`,
        data,
        components,
      )
      components.Carrier = compile(
        `<script setup vapor>const components = _components</script>
        <template>
          <components.Receiver>
            <slot name="a" />
            <slot name="b" />
          </components.Receiver>
        </template>`,
        data,
        components,
      )
      const App = compile(
        `<script setup>
        const components = _components
        const data = _data
        </script>
        <template>
          <components.Carrier>
            <template #a><span v-if="data.showA">A</span></template>
            <template #b><span v-if="data.showB">B</span></template>
          </components.Carrier>
        </template>`,
        data,
        components,
        { vapor: false },
      )
      const root = document.createElement('div')
      const app = createApp(App).use(vaporInteropPlugin)
      app.mount(root)

      expect(root.textContent).toBe('fallback')
      expect(root.innerHTML).toBe('<span>fallback</span><!--slot-->')

      data.value.showA = true
      await nextTick()
      expect(root.textContent).toBe('A')
      expect(root.innerHTML).toBe('<span>A</span><!--slot-->')

      data.value.showA = false
      data.value.showB = true
      await nextTick()
      expect(root.textContent).toBe('B')
      expect(root.innerHTML).toBe('<span>B</span><!--slot-->')

      data.value.showA = true
      await nextTick()
      expect(root.textContent).toBe('AB')
      expect(root.innerHTML).toBe('<span>A</span><span>B</span><!--slot-->')

      data.value.showA = false
      data.value.showB = false
      await nextTick()
      expect(root.textContent).toBe('fallback')
      expect(root.innerHTML).toBe('<span>fallback</span><!--slot-->')
      app.unmount()
    })

    test('vdom local fallback restores before a stable sibling', async () => {
      const data = ref({ showA: false })
      const components: Record<string, any> = {}
      components.Receiver = compile(
        `<template><slot><b>receiver fallback</b></slot></template>`,
        data,
        components,
      )
      components.Carrier = compile(
        `<script setup vapor>
        const components = _components
        const data = _data
        </script>
        <template>
          <components.Receiver>
            <slot name="a"><span v-if="data.showA">A</span></slot>
            <span>C</span>
          </components.Receiver>
        </template>`,
        data,
        components,
      )
      const App = compile(
        `<script setup>const components = _components</script>
        <template><components.Carrier /></template>`,
        data,
        components,
        { vapor: false },
      )
      const root = document.createElement('div')
      const app = createApp(App).use(vaporInteropPlugin)
      app.mount(root)

      expect(root.textContent).toBe('C')

      data.value.showA = true
      await nextTick()
      expect(root.textContent).toBe('AC')

      data.value.showA = false
      await nextTick()
      expect(root.textContent).toBe('C')

      data.value.showA = true
      await nextTick()
      expect(root.textContent).toBe('AC')
      app.unmount()
    })

    test('v-once forwarded root from vdom keeps invalid content in place', async () => {
      const show = ref(true)
      const components: Record<string, any> = {}
      components.Receiver = compile(
        `<template><slot><span>fallback</span></slot></template>`,
        show,
        components,
      )
      components.Carrier = compile(
        `<script setup vapor>const components = _components</script>
        <template>
          <components.Receiver>
            <slot v-once name="a" />
            <slot name="b" />
          </components.Receiver>
        </template>`,
        show,
        components,
      )
      const App = compile(
        `<script setup>const components = _components; const data = _data</script>
        <template>
          <components.Carrier>
            <template #a><span v-if="false">A</span></template>
            <template #b><span v-if="data">B</span></template>
          </components.Carrier>
        </template>`,
        show,
        components,
        { vapor: false },
      )
      const root = document.createElement('div')
      const app = createApp(App).use(vaporInteropPlugin)
      app.mount(root)

      expect(root.textContent).toBe('B')
      const contentNodeCount = root.childNodes.length
      expect(contentNodeCount).toBeGreaterThan(2)

      show.value = false
      await nextTick()
      expect(root.textContent).toBe('fallback')
      expect(root.innerHTML).toMatchInlineSnapshot(
        `"<span>fallback</span><!--slot-->"`,
      )

      show.value = true
      await nextTick()
      expect(root.textContent).toBe('B')
      expect(root.childNodes).toHaveLength(contentNodeCount)

      show.value = false
      await nextTick()
      app.unmount()
      expect(root.childNodes).toHaveLength(0)
    })

    test('an invalid static comment slot root stays in place', async () => {
      const show = ref(true)
      const components: Record<string, any> = {}
      components.Receiver = compile(
        `<template><slot><span>fallback</span></slot></template>`,
        show,
        components,
      )
      components.Carrier = compile(
        `<script setup vapor>const components = _components</script>
        <template>
          <components.Receiver>
            <slot name="a" />
            <slot name="b" />
          </components.Receiver>
        </template>`,
        show,
        components,
      )
      const App = compile(
        `<script setup vapor>
        const components = _components
        const data = _data
        </script>
        <template>
          <components.Carrier>
            <template #a><!--invalid static comment--></template>
            <template #b><span v-if="data">B</span></template>
          </components.Carrier>
        </template>`,
        show,
        components,
      )
      const { host } = define(App).render()

      expect(host.innerHTML).toContain('<!--invalid static comment-->')

      show.value = false
      await nextTick()
      expect(host.textContent).toBe('fallback')
      expect(host.innerHTML).toContain('<!--invalid static comment-->')
    })

    test('nested slot under a stable branch does not consume receiver fallback', async () => {
      const ok = ref(true)
      const components: Record<string, any> = {}
      components.Receiver = compile(
        `<template><slot><b>receiver fallback</b></slot></template>`,
        ok,
        components,
      )
      components.Carrier = compile(
        `<script setup vapor>const components = _components; const data = _data</script>
        <template>
          <components.Receiver>
            <template v-if="data"><div><slot /></div></template>
          </components.Receiver>
        </template>`,
        ok,
        components,
      )
      const App = compile(
        `<script setup vapor>const components = _components</script>
        <template><components.Carrier /></template>`,
        ok,
        components,
      )

      const { host } = define(App).render()

      expect(host.textContent).toBe('')

      ok.value = false
      await nextTick()
      expect(host.textContent).toBe('receiver fallback')
    })

    test('v-for restores slot boundary for newly created roots', async () => {
      const data = ref({ items: [] as number[], show: false })
      const components: Record<string, any> = {}
      components.Receiver = compile(
        `<template><slot><b>receiver fallback</b></slot></template>`,
        data,
        components,
      )
      components.Carrier = compile(
        `<script setup vapor>const components = _components; const data = _data</script>
        <template>
          <components.Receiver>
            <slot v-for="item in data.items" :key="item" />
          </components.Receiver>
        </template>`,
        data,
        components,
      )
      const App = compile(
        `<script setup vapor>const components = _components; const data = _data</script>
        <template>
          <components.Carrier><span v-if="data.show">content</span></components.Carrier>
        </template>`,
        data,
        components,
      )

      const { host } = define(App).render()

      expect(host.textContent).toBe('receiver fallback')

      data.value.items.push(1)
      await nextTick()
      data.value.show = true
      await nextTick()
      expect(host.textContent).toBe('content')
    })
  })

  describe('createSlot', () => {
    test('slot should be rendered correctly', () => {
      const Comp = defineVaporComponent(() => {
        const n0 = template('<div>')()
        insert(createSlot('header'), n0 as any as ParentNode)
        return n0
      })

      const { host } = define(() => {
        return createComponent(Comp, null, {
          header: () => template('header')(),
        })
      }).render()

      expect(host.innerHTML).toBe('<div>header<!--slot--></div>')
    })

    test('slot should be rendered correctly with slot props', async () => {
      const src = ref('header')

      const Comp = defineVaporComponent(() => {
        const n0 = template('<div></div>')()
        insert(
          createSlot('header', { prefix: 'static', title: () => src.value }),
          n0 as any as ParentNode,
        )
        return n0
      })

      const { host } = define(() => {
        return createComponent(Comp, null, {
          header: props => {
            const el = template('<h1></h1>')()
            renderEffect(() => {
              setElementText(el, `${props.prefix}:${props.title}`)
            })
            return el
          },
        })
      }).render()

      expect(host.innerHTML).toBe(
        '<div><h1>static:header</h1><!--slot--></div>',
      )

      src.value = 'footer'
      await nextTick()
      expect(host.innerHTML).toBe(
        '<div><h1>static:footer</h1><!--slot--></div>',
      )
    })

    test('slot props should be isolated per fragment in v-for', async () => {
      const items = ref([0, 1, 2])

      const Child = defineVaporComponent(() => {
        const list = createFor(
          () => items.value,
          for_item0 => {
            const n0 = template('<div></div>')()
            insert(
              createSlot('age-option', { age: () => for_item0.value }),
              n0 as any as ParentNode,
            )
            return n0
          },
        )
        return list
      })

      const { host } = define(() => {
        return createComponent(Child, null, {
          'age-option': (props: any) => {
            const el = template('<span></span>')()
            renderEffect(() => {
              setElementText(el, toDisplayString(props.age))
            })
            return el
          },
        })
      }).render()

      expect(host.innerHTML).toBe(
        '<div><span>0</span><!--slot--></div>' +
          '<div><span>1</span><!--slot--></div>' +
          '<div><span>2</span><!--slot--></div><!--for-->',
      )

      items.value = [3, 4]
      await nextTick()
      expect(host.innerHTML).toBe(
        '<div><span>3</span><!--slot--></div>' +
          '<div><span>4</span><!--slot--></div><!--for-->',
      )
    })

    test('dynamic slot props', async () => {
      let props: any

      const bindObj = ref<Record<string, any>>({ foo: 1, baz: 'qux' })
      const Comp = defineVaporComponent(() =>
        createSlot('default', { $: [() => bindObj.value] }),
      )
      define(() =>
        createComponent(Comp, null, {
          default: (_props: any) => ((props = _props), []),
        }),
      ).render()

      expect(props).toEqual({ foo: 1, baz: 'qux' })

      bindObj.value.foo = 2
      await nextTick()
      expect(props).toEqual({ foo: 2, baz: 'qux' })

      delete bindObj.value.baz
      await nextTick()
      expect(props).toEqual({ foo: 2 })
    })

    test('dynamic slot props with static slot props', async () => {
      let props: any

      const foo = ref(0)
      const bindObj = ref<Record<string, any>>({ foo: 100, baz: 'qux' })
      const Comp = defineVaporComponent(() =>
        createSlot('default', {
          foo: () => foo.value,
          $: [() => bindObj.value],
        }),
      )
      define(() =>
        createComponent(Comp, null, {
          default: (_props: any) => ((props = _props), []),
        }),
      ).render()

      expect(props).toEqual({ foo: 100, baz: 'qux' })

      foo.value = 2
      await nextTick()
      expect(props).toEqual({ foo: 100, baz: 'qux' })

      delete bindObj.value.foo
      await nextTick()
      expect(props).toEqual({ foo: 2, baz: 'qux' })
    })

    test('dynamic slot should be rendered correctly with slot props', async () => {
      const val = ref('header')

      const Comp = defineVaporComponent(() => {
        const n0 = template('<div></div>')()
        insert(
          createSlot('header', { title: () => val.value }),
          n0 as any as ParentNode,
        )
        return n0
      })

      const { host } = define(() => {
        // dynamic slot
        return createComponent(Comp, null, {
          $: [
            () => ({
              name: 'header',
              fn: (props: any) => {
                const el = template('<h1></h1>')()
                renderEffect(() => {
                  setElementText(el, props.title)
                })
                return el
              },
            }),
          ],
        })
      }).render()

      expect(host.innerHTML).toBe('<div><h1>header</h1><!--slot--></div>')

      val.value = 'footer'
      await nextTick()
      expect(host.innerHTML).toBe('<div><h1>footer</h1><!--slot--></div>')
    })

    test('dynamic slot outlet should be render correctly with slot props', async () => {
      const val = ref('header')

      const Comp = defineVaporComponent(() => {
        const n0 = template('<div></div>')()
        insert(
          createSlot(
            () => val.value, // dynamic slot outlet name
          ),
          n0 as any as ParentNode,
        )
        return n0
      })

      const { host } = define(() => {
        return createComponent(Comp, null, {
          header: () => template('header')(),
          footer: () => template('footer')(),
        })
      }).render()

      expect(host.innerHTML).toBe('<div>header<!--slot--></div>')

      val.value = 'footer'
      await nextTick()
      expect(host.innerHTML).toBe('<div>footer<!--slot--></div>')
    })

    test('dynamic slot source inside forwarded slot should preserve owner', async () => {
      const msg = ref('late')
      const Leaf = defineVaporComponent(() => createSlot('late', null))
      const Carrier = defineVaporComponent(() => createSlot('default', null))
      const Root = defineVaporComponent(() => {
        const slots = useSlots()
        return createComponent(Carrier, null, {
          default: () =>
            createComponent(Leaf, null, {
              $: [
                createForSlots(
                  () => slots,
                  (_slot, name) => () => createSlot(() => name!.value),
                  (_slot, name) => name,
                ),
              ],
            }),
        })
      })

      const { host } = define(() =>
        createComponent(Root, null, {
          late: () => {
            const n0 = template('<span></span>')()
            renderEffect(() => setElementText(n0, msg.value))
            return n0
          },
        }),
      ).render()

      expect(host.innerHTML).toBe(
        '<span>late</span><!--slot--><!--slot--><!--slot-->',
      )

      msg.value = 'updated'
      await nextTick()
      expect(host.innerHTML).toBe(
        '<span>updated</span><!--slot--><!--slot--><!--slot-->',
      )
    })

    test('fallback should be render correctly', () => {
      const Comp = defineVaporComponent(() => {
        const n0 = template('<div></div>')()
        insert(
          createSlot('header', undefined, () => template('fallback')()),
          n0 as any as ParentNode,
        )
        return n0
      })

      const { host } = define(() => {
        return createComponent(Comp, {}, {})
      }).render()

      expect(host.innerHTML).toBe('<div>fallback<!--slot--></div>')
    })

    test('dynamic slot should be updated correctly', async () => {
      const flag1 = ref(true)

      const Child = defineVaporComponent(() => {
        const temp0 = template('<p></p>')
        const el0 = temp0()
        const el1 = temp0()
        const slot1 = createSlot('one', null, () => template('one fallback')())
        const slot2 = createSlot('two', null, () => template('two fallback')())
        insert(slot1, el0 as any as ParentNode)
        insert(slot2, el1 as any as ParentNode)
        return [el0, el1]
      })

      const { host } = define(() => {
        return createComponent(Child, null, {
          $: [
            () =>
              flag1.value
                ? {
                    name: 'one',
                    fn: () => template('one content')(),
                  }
                : {
                    name: 'two',
                    fn: () => template('two content')(),
                  },
          ],
        })
      }).render()

      expect(host.innerHTML).toBe(
        '<p>one content<!--slot--></p><p>two fallback<!--slot--></p>',
      )

      flag1.value = false
      await nextTick()

      expect(host.innerHTML).toBe(
        '<p>one fallback<!--slot--></p><p>two content<!--slot--></p>',
      )

      flag1.value = true
      await nextTick()

      expect(host.innerHTML).toBe(
        '<p>one content<!--slot--></p><p>two fallback<!--slot--></p>',
      )
    })

    test('dynamic slot outlet should be updated correctly', async () => {
      const slotOutletName = ref('one')

      const Child = defineVaporComponent(() => {
        const temp0 = template('<p>')
        const el0 = temp0()
        const slot1 = createSlot(
          () => slotOutletName.value,
          undefined,
          () => template('fallback')(),
        )
        insert(slot1, el0 as any as ParentNode)
        return el0
      })

      const { host } = define(() => {
        return createComponent(
          Child,
          {},
          {
            one: () => template('one content')(),
            two: () => template('two content')(),
          },
        )
      }).render()

      expect(host.innerHTML).toBe('<p>one content<!--slot--></p>')

      slotOutletName.value = 'two'
      await nextTick()

      expect(host.innerHTML).toBe('<p>two content<!--slot--></p>')

      slotOutletName.value = 'none'
      await nextTick()

      expect(host.innerHTML).toBe('<p>fallback<!--slot--></p>')
    })

    test('non-exist slot', async () => {
      const Child = defineVaporComponent(() => {
        const el0 = template('<p>')()
        const slot = createSlot('not-exist', undefined)
        insert(slot, el0 as any as ParentNode)
        return el0
      })

      const { host } = define(() => {
        return createComponent(Child)
      }).render()

      expect(host.innerHTML).toBe('<p><!--slot--></p>')
    })

    test('use fallback when inner content changes', async () => {
      const Child = {
        setup() {
          return createSlot('default', null, () =>
            document.createTextNode('fallback'),
          )
        },
      }

      const toggle = ref(true)

      const { html } = define({
        setup() {
          return createComponent(Child, null, {
            default: extend(() => {
              return createIf(
                () => toggle.value,
                () => {
                  return document.createTextNode('content')
                },
                undefined,
                keyedSlotRootIfShape,
              )
            }, nonStableSlot),
          })
        },
      }).render()

      expect(html()).toBe('content<!--if--><!--slot-->')

      toggle.value = false
      await nextTick()
      expect(html()).toBe('<!--if-->fallback<!--slot-->')

      toggle.value = true
      await nextTick()
      expect(html()).toBe('content<!--if--><!--slot-->')
    })

    test('use fallback on initial render', async () => {
      const Child = {
        setup() {
          return createSlot('default', null, () =>
            document.createTextNode('fallback'),
          )
        },
      }

      const toggle = ref(false)

      const { html } = define({
        setup() {
          return createComponent(Child, null, {
            default: extend(() => {
              return createIf(
                () => toggle.value,
                () => {
                  return document.createTextNode('content')
                },
                undefined,
                keyedSlotRootIfShape,
              )
            }, nonStableSlot),
          })
        },
      }).render()

      expect(html()).toBe('<!--if-->fallback<!--slot-->')

      toggle.value = true
      await nextTick()
      expect(html()).toBe('content<!--if--><!--slot-->')

      toggle.value = false
      await nextTick()
      expect(html()).toBe('<!--if-->fallback<!--slot-->')
    })

    test('dynamic slot work with v-if', async () => {
      const val = ref('header')
      const toggle = ref(false)

      const Comp = defineVaporComponent(() => {
        const n0 = template('<div></div>')()
        insert(createSlot('header', null), n0 as any as ParentNode)
        return n0
      })

      const { host } = define(() => {
        // dynamic slot
        return createComponent(Comp, null, {
          $: [
            () =>
              (toggle.value
                ? {
                    name: val.value,
                    fn: () => {
                      return template('<h1></h1>')()
                    },
                  }
                : void 0) as DynamicSlot,
          ],
        })
      }).render()

      expect(host.innerHTML).toBe('<div><!--slot--></div>')

      toggle.value = true
      await nextTick()
      expect(host.innerHTML).toBe('<div><h1></h1><!--slot--></div>')
    })

    test('slots proxy ownKeys trap correctly reflects dynamic slot presence', async () => {
      const val = ref('header')
      const toggle = ref(false)

      let instance: any
      const Comp = defineVaporComponent(() => {
        instance = currentInstance
        const n0 = template('<div></div>')()
        insert(createSlot('header', null), n0 as any as ParentNode)
        return n0
      })

      define(() => {
        // dynamic slot
        return createComponent(Comp, null, {
          $: [
            () =>
              (toggle.value
                ? {
                    name: val.value,
                    fn: () => {
                      return template('<h1></h1>')()
                    },
                  }
                : void 0) as DynamicSlot,
          ],
        })
      }).render()

      expect(Reflect.ownKeys(instance.slots)).not.toContain('header')

      toggle.value = true
      await nextTick()
      expect(Reflect.ownKeys(instance.slots)).toContain('header')

      toggle.value = false
      await nextTick()
      expect(Reflect.ownKeys(instance.slots)).not.toContain('header')
    })

    test('render fallback when slot content is not valid', async () => {
      const Child = {
        setup() {
          return createSlot('default', null, () =>
            document.createTextNode('fallback'),
          )
        },
      }

      const { html } = define({
        setup() {
          return createComponent(Child, null, {
            default: extend(() => {
              return template('<!--comment-->')()
            }, nonStableSlot),
          })
        },
      }).render()

      expect(html()).toBe('<!--comment-->fallback<!--slot-->')
    })

    test('render fallback when v-if condition is false', async () => {
      const Child = {
        setup() {
          return createSlot('default', null, () =>
            document.createTextNode('fallback'),
          )
        },
      }

      const toggle = ref(false)

      const { html } = define({
        setup() {
          return createComponent(Child, null, {
            default: extend(() => {
              return createIf(
                () => toggle.value,
                () => {
                  return document.createTextNode('content')
                },
                undefined,
                keyedSlotRootIfShape,
              )
            }, nonStableSlot),
          })
        },
      }).render()

      expect(html()).toBe('<!--if-->fallback<!--slot-->')

      toggle.value = true
      await nextTick()
      expect(html()).toBe('content<!--if--><!--slot-->')

      toggle.value = false
      await nextTick()
      expect(html()).toBe('<!--if-->fallback<!--slot-->')
    })

    test('render fallback with nested v-if', async () => {
      const Child = {
        setup() {
          return createSlot('default', null, () =>
            document.createTextNode('fallback'),
          )
        },
      }

      const outerShow = ref(false)
      const innerShow = ref(false)

      const { html } = define({
        setup() {
          return createComponent(Child, null, {
            default: extend(() => {
              return createIf(
                () => outerShow.value,
                () => {
                  return createIf(
                    () => innerShow.value,
                    () => {
                      return document.createTextNode('content')
                    },
                    undefined,
                    keyedSlotRootIfShape,
                  )
                },
                undefined,
                keyedSlotRootIfShape,
              )
            }, nonStableSlot),
          })
        },
      }).render()

      expect(html()).toBe('<!--if-->fallback<!--slot-->')

      outerShow.value = true
      await nextTick()
      expect(html()).toBe('<!--if--><!--if-->fallback<!--slot-->')

      innerShow.value = true
      await nextTick()
      expect(html()).toBe('content<!--if--><!--if--><!--slot-->')

      innerShow.value = false
      await nextTick()
      expect(html()).toBe('<!--if--><!--if-->fallback<!--slot-->')

      outerShow.value = false
      await nextTick()
      expect(html()).toBe('<!--if-->fallback<!--slot-->')

      outerShow.value = true
      await nextTick()
      expect(html()).toBe('<!--if--><!--if-->fallback<!--slot-->')

      innerShow.value = true
      await nextTick()
      expect(html()).toBe('content<!--if--><!--if--><!--slot-->')
    })

    test('render fallback with v-for', async () => {
      const Child = {
        setup() {
          return createSlot('default', null, () =>
            document.createTextNode('fallback'),
          )
        },
      }

      const items = ref<number[]>([1])
      const { html } = define({
        setup() {
          return createComponent(Child, null, {
            default: extend(() => {
              const n2 = createFor(
                () => items.value,
                for_item0 => {
                  const n4 = template('<span> </span>')() as any
                  const x4 = child(n4) as any
                  renderEffect(() =>
                    setText(x4, toDisplayString(for_item0.value)),
                  )
                  return n4
                },
                undefined,
                slotRootForFlags,
              )
              return n2
            }, nonStableSlot),
          })
        },
      }).render()

      expect(html()).toBe('<span>1</span><!--for--><!--slot-->')

      items.value.pop()
      await nextTick()
      expect(html()).toBe('<!--for-->fallback<!--slot-->')

      items.value.pop()
      await nextTick()
      expect(html()).toBe('<!--for-->fallback<!--slot-->')

      items.value.push(2)
      await nextTick()
      expect(html()).toBe('<span>2</span><!--for--><!--slot-->')
    })

    test('render fallback with v-for (empty source)', async () => {
      const Child = {
        setup() {
          return createSlot('default', null, () =>
            document.createTextNode('fallback'),
          )
        },
      }

      const items = ref<number[]>([])
      const { html } = define({
        setup() {
          return createComponent(Child, null, {
            default: extend(() => {
              const n2 = createFor(
                () => items.value,
                for_item0 => {
                  const n4 = template('<span> </span>')() as any
                  const x4 = child(n4) as any
                  renderEffect(() =>
                    setText(x4, toDisplayString(for_item0.value)),
                  )
                  return n4
                },
                undefined,
                slotRootForFlags,
              )
              return n2
            }, nonStableSlot),
          })
        },
      }).render()

      expect(html()).toBe('<!--for-->fallback<!--slot-->')

      items.value.push(1)
      await nextTick()
      expect(html()).toBe('<span>1</span><!--for--><!--slot-->')

      items.value.pop()
      await nextTick()
      expect(html()).toBe('<!--for-->fallback<!--slot-->')

      items.value.pop()
      await nextTick()
      expect(html()).toBe('<!--for-->fallback<!--slot-->')

      items.value.push(2)
      await nextTick()
      expect(html()).toBe('<span>2</span><!--for--><!--slot-->')
    })

    test('render fallback with invalid v-for branch', async () => {
      const Child = {
        setup() {
          return createSlot('default', null, () =>
            document.createTextNode('fallback'),
          )
        },
      }

      const items = ref([{ text: 'bar', show: false }])
      let ifFrag!: DynamicFragment
      let forFrag!: any
      const { html, host } = define({
        setup() {
          return createComponent(Child, null, {
            default: extend(() => {
              forFrag = createFor(
                () => items.value,
                for_item0 => {
                  ifFrag = createIf(
                    () => for_item0.value.show,
                    () => {
                      const n5 = template('<span> </span>')() as any
                      const x5 = child(n5) as any
                      renderEffect(() =>
                        setText(x5, toDisplayString(for_item0.value.text)),
                      )
                      return n5
                    },
                    undefined,
                    keyedSlotRootIfShape,
                  ) as DynamicFragment
                  return ifFrag
                },
                item => item.text,
                slotRootForFlags,
              )
              return forFrag
            }, nonStableSlot),
          })
        },
      }).render()

      expect(html()).toBe('<!--if--><!--for-->fallback<!--slot-->')
      expect(ifFrag.anchor.parentNode).toBe(host)
      expect((forFrag.nodes[1] as Node).parentNode).toBe(host)

      items.value[0].show = true
      await nextTick()
      expect(html()).toBe('<span>bar</span><!--if--><!--for--><!--slot-->')

      items.value[0].show = false
      await nextTick()
      expect(html()).toBe('<!--if--><!--for-->fallback<!--slot-->')
    })

    test('should not render fallback for a single empty item in v-for', async () => {
      const Child = {
        setup() {
          return createSlot('default', null, () =>
            document.createTextNode('fallback'),
          )
        },
      }

      const items = ref([
        { text: 'bar', show: true },
        { text: 'baz', show: true },
      ])
      const { html } = define({
        setup() {
          return createComponent(Child, null, {
            default: () => {
              return createFor(
                () => items.value,
                for_item0 => {
                  return createIf(
                    () => for_item0.value.show,
                    () => {
                      const n5 = template('<span> </span>')() as any
                      const x5 = child(n5) as any
                      renderEffect(() =>
                        setText(x5, toDisplayString(for_item0.value.text)),
                      )
                      return n5
                    },
                    undefined,
                    keyedSlotRootIfShape,
                  )
                },
                item => item.text,
                slotRootForFlags,
              )
            },
          })
        },
      }).render()

      expect(html()).toBe(
        '<span>bar</span><!--if--><span>baz</span><!--if--><!--for--><!--slot-->',
      )

      items.value[1].show = false
      await nextTick()
      expect(html()).toBe(
        '<span>bar</span><!--if--><!--if--><!--for--><!--slot-->',
      )
    })

    test('work with v-once', async () => {
      const Child = defineVaporComponent({
        setup() {
          return createSlot('default', null, undefined, VaporSlotFlags.ONCE)
        },
      })

      const count = ref(0)

      const { html } = define({
        setup() {
          return createComponent(Child, null, {
            default: () => {
              const n3 = template('<div> </div>')() as any
              const x3 = txt(n3) as any
              renderEffect(() => setText(x3, toDisplayString(count.value)))
              return n3
            },
          })
        },
      }).render()

      expect(html()).toBe('<div>0</div><!--slot-->')

      // expect no changes due to v-once
      count.value++
      await nextTick()
      expect(html()).toBe('<div>0</div><!--slot-->')
    })

    test('applies v-once to fallback', async () => {
      const count = ref(0)
      const Child = defineVaporComponent({
        setup() {
          return createSlot(
            'default',
            null,
            () => {
              const n3 = template('<div> </div>')() as any
              const x3 = txt(n3) as any
              renderEffect(() => setText(x3, toDisplayString(count.value)))
              return n3
            },
            VaporSlotFlags.ONCE,
          )
        },
      })

      let html!: () => string
      __DEV__ = false
      try {
        ;({ html } = define({
          setup() {
            return createComponent(Child)
          },
        }).render())
      } finally {
        __DEV__ = true
      }

      expect(html()).toBe('<div>0</div>')

      count.value++
      await nextTick()
      expect(html()).toBe('<div>0</div>')
    })

    test('preserves Vapor child updates inside v-once fallback', async () => {
      let increment!: () => void
      const normalLabel = ref('normal')
      const label = ref('initial')
      const GrandChild = defineVaporComponent({
        props: ['label'],
        setup(props: any) {
          const count = ref(0)
          increment = () => count.value++
          const n0 = template('<span> </span>')() as any
          const t0 = txt(n0) as any
          renderEffect(() => setText(t0, `${props.label}:${count.value}`))
          return n0
        },
      })
      const Child = defineVaporComponent({
        setup() {
          return createSlot(
            'default',
            null,
            () => createComponent(GrandChild, { label: () => label.value }),
            VaporSlotFlags.ONCE,
          )
        },
      })

      const { html } = define({
        setup() {
          return [
            createComponent(GrandChild, { label: () => normalLabel.value }),
            createComponent(Child),
          ]
        },
      }).render()

      expect(html()).toBe(
        '<span>normal:0</span><span>initial:0</span><!--slot-->',
      )

      normalLabel.value = 'normal updated'
      label.value = 'updated'
      increment()
      await nextTick()
      expect(html()).toBe(
        '<span>normal updated:0</span><span>initial:1</span><!--slot-->',
      )
    })

    test('preserves async Vapor child updates inside v-once fallback', async () => {
      let resolve!: (comp: any) => void
      let increment!: () => void
      const label = ref('initial')
      const AsyncGrandChild = defineVaporAsyncComponent(
        () =>
          new Promise(r => {
            resolve = r
          }),
      )
      const Child = defineVaporComponent({
        setup() {
          return createSlot(
            'default',
            null,
            () =>
              createComponent(AsyncGrandChild, { label: () => label.value }),
            VaporSlotFlags.ONCE,
          )
        },
      })

      const { html } = define({
        setup() {
          return createComponent(Child)
        },
      }).render()

      expect(html()).toBe('<!--async component--><!--slot-->')

      resolve(
        defineVaporComponent({
          props: ['label'],
          setup(props: any) {
            const count = ref(0)
            increment = () => count.value++
            const n0 = template('<span> </span>')() as any
            const t0 = txt(n0) as any
            renderEffect(() => setText(t0, `${props.label}:${count.value}`))
            return n0
          },
        }),
      )
      await new Promise(r => setTimeout(r))
      expect(html()).toBe(
        '<span>initial:0</span><!--async component--><!--slot-->',
      )

      label.value = 'updated'
      increment()
      await nextTick()
      expect(html()).toBe(
        '<span>initial:1</span><!--async component--><!--slot-->',
      )
    })

    test('caches v-once fallback child props with prototype names', async () => {
      const label = ref('initial')
      const GrandChild = defineVaporComponent({
        props: ['toString'],
        setup(props: any) {
          const n0 = template('<span> </span>')() as any
          const t0 = txt(n0) as any
          renderEffect(() => setText(t0, props.toString))
          return n0
        },
      })
      const Child = defineVaporComponent({
        setup() {
          return createSlot(
            'default',
            null,
            () => createComponent(GrandChild, { toString: () => label.value }),
            VaporSlotFlags.ONCE,
          )
        },
      })

      const { html } = define({
        setup() {
          return createComponent(Child)
        },
      }).render()

      expect(html()).toBe('<span>initial</span><!--slot-->')

      label.value = 'updated'
      await nextTick()
      expect(html()).toBe('<span>initial</span><!--slot-->')
    })

    test('freezes fallthrough attr keys on v-once fallback child', async () => {
      const attrs = ref<Record<string, string>>({ id: 'initial' })
      const GrandChild = defineVaporComponent({
        setup() {
          return template('<span>child</span>')()
        },
      })
      const Child = defineVaporComponent({
        setup() {
          return createSlot(
            'default',
            null,
            () => createComponent(GrandChild, { $: [() => attrs.value] }),
            VaporSlotFlags.ONCE,
          )
        },
      })

      const { html } = define({
        setup() {
          return createComponent(Child)
        },
      }).render()

      expect(html()).toBe('<span id="initial">child</span><!--slot-->')

      attrs.value = { id: 'updated', class: 'new' }
      await nextTick()
      expect(html()).toBe('<span id="initial">child</span><!--slot-->')
    })

    test('snapshots reused dynamic props objects on delayed v-once fallback child reads', async () => {
      let reveal!: () => void
      const raw = { label: 'initial' }
      const GrandChild = defineVaporComponent({
        props: ['label'],
        setup(props: any) {
          const show = ref(false)
          reveal = () => (show.value = true)
          const n0 = template('<span> </span>')() as any
          const t0 = txt(n0) as any
          renderEffect(() => setText(t0, show.value ? props.label : 'hidden'))
          return n0
        },
      })
      const Child = defineVaporComponent({
        setup() {
          return createSlot(
            'default',
            null,
            () => createComponent(GrandChild, { $: [() => raw] }),
            VaporSlotFlags.ONCE,
          )
        },
      })

      let html!: () => string
      __DEV__ = false
      try {
        ;({ html } = define({
          setup() {
            return createComponent(Child)
          },
        }).render())
      } finally {
        __DEV__ = true
      }

      expect(html()).toBe('<span>hidden</span>')

      raw.label = 'updated'
      reveal()
      await nextTick()
      expect(html()).toBe('<span>initial</span>')
    })

    test('preserves function-valued props from dynamic sources on v-once fallback child', () => {
      let calls = 0
      const cb = () => {
        calls++
        return 'called'
      }
      const raw = { cb }
      const GrandChild = defineVaporComponent({
        props: ['cb'],
        setup(props: any) {
          const n0 = template('<span> </span>')() as any
          const t0 = txt(n0) as any
          renderEffect(() =>
            setText(t0, `${typeof props.cb}:${props.cb === cb}`),
          )
          return n0
        },
      })
      const Child = defineVaporComponent({
        setup() {
          return createSlot(
            'default',
            null,
            () => createComponent(GrandChild, { $: [() => raw] }),
            VaporSlotFlags.ONCE,
          )
        },
      })

      const { html } = define({
        setup() {
          return createComponent(Child)
        },
      }).render()

      expect(html()).toBe('<span>function:true</span><!--slot-->')
      expect(calls).toBe(0)
    })

    test('snapshots delayed prop reads on v-once fallback child', async () => {
      let reveal!: () => void
      const label = ref('initial')
      const GrandChild = defineVaporComponent({
        props: ['label'],
        setup(props: any) {
          const show = ref(false)
          reveal = () => (show.value = true)
          const n0 = template('<span> </span>')() as any
          const t0 = txt(n0) as any
          renderEffect(() => setText(t0, show.value ? props.label : 'hidden'))
          return n0
        },
      })
      const Child = defineVaporComponent({
        setup() {
          return createSlot(
            'default',
            null,
            () => createComponent(GrandChild, { label: () => label.value }),
            VaporSlotFlags.ONCE,
          )
        },
      })

      let html!: () => string
      __DEV__ = false
      try {
        ;({ html } = define({
          setup() {
            return createComponent(Child)
          },
        }).render())
      } finally {
        __DEV__ = true
      }

      expect(html()).toBe('<span>hidden</span>')

      label.value = 'updated'
      reveal()
      await nextTick()
      expect(html()).toBe('<span>initial</span>')
    })

    test('snapshots delayed attr reads on v-once fallback child', async () => {
      let reveal!: () => void
      const parentAttrs = ref<Record<string, string>>({ title: 'initial' })
      const GrandChild = defineVaporComponent({
        inheritAttrs: false,
        setup(_: any, { attrs }: any) {
          const show = ref(false)
          reveal = () => (show.value = true)
          const n0 = template('<span> </span>')() as any
          const t0 = txt(n0) as any
          renderEffect(() =>
            setText(
              t0,
              show.value ? `${attrs.title}:${String(attrs.class)}` : 'hidden',
            ),
          )
          return n0
        },
      })
      const Child = defineVaporComponent({
        setup() {
          return createSlot(
            'default',
            null,
            () => createComponent(GrandChild, { $: [() => parentAttrs.value] }),
            VaporSlotFlags.ONCE,
          )
        },
      })

      const { html } = define({
        setup() {
          return createComponent(Child)
        },
      }).render()

      expect(html()).toBe('<span>hidden</span><!--slot-->')

      parentAttrs.value = { title: 'updated', class: 'new' }
      reveal()
      await nextTick()
      expect(html()).toBe('<span>initial:undefined</span><!--slot-->')
    })

    test('caches prototype-named attrs on v-once fallback child', () => {
      const raw = Object.create(null)
      Object.defineProperty(raw, '__proto__', {
        value: 'initial',
        enumerable: true,
      })
      const GrandChild = defineVaporComponent({
        inheritAttrs: false,
        setup(_: any, { attrs }: any) {
          const n0 = template('<span> </span>')() as any
          const t0 = txt(n0) as any
          renderEffect(() => setText(t0, String(attrs.__proto__)))
          return n0
        },
      })
      const Child = defineVaporComponent({
        setup() {
          return createSlot(
            'default',
            null,
            () => createComponent(GrandChild, { $: [() => raw] }),
            VaporSlotFlags.ONCE,
          )
        },
      })

      const { html } = define({
        setup() {
          return createComponent(Child)
        },
      }).render()

      expect(html()).toBe('<span>initial</span><!--slot-->')
    })

    test('snapshots delayed slot prop reads in v-once slot content', async () => {
      let increment!: () => void
      const label = ref('initial')
      const Child = defineVaporComponent({
        setup() {
          return createSlot(
            'default',
            { label: () => label.value },
            undefined,
            VaporSlotFlags.ONCE,
          )
        },
      })

      const { html } = define({
        setup() {
          return createComponent(Child, null, {
            default: (slotProps: any) => {
              const GrandChild = defineVaporComponent({
                setup() {
                  const count = ref(0)
                  increment = () => count.value++
                  const n0 = template('<span> </span>')() as any
                  const t0 = txt(n0) as any
                  renderEffect(() =>
                    setText(t0, `${slotProps.label}:${count.value}`),
                  )
                  return n0
                },
              })
              return createComponent(GrandChild)
            },
          })
        },
      }).render()

      expect(html()).toBe('<span>initial:0</span><!--slot-->')

      label.value = 'updated'
      increment()
      await nextTick()
      expect(html()).toBe('<span>initial:1</span><!--slot-->')
    })

    describe('slot fast path', () => {
      describe('runtime', () => {
        test('plain slot without fallback', () => {
          let slotBlock!: Block
          let observedBoundary: SlotBoundaryContext | null | undefined
          const Comp = defineVaporComponent(() => {
            return (slotBlock = createForwardedSlotRoot('default'))
          })

          define(() =>
            createComponent(Comp, null, {
              default: () => {
                observedBoundary = currentRenderContext.slotBoundary
                return template('content')()
              },
            }),
          ).render()

          expect(slotBlock).toBeInstanceOf(DynamicFragment)
          expect(slotBlock).not.toBeInstanceOf(SlotFragment)
          expect(isVaporSlotOutlet(slotBlock)).toBe(true)
          expect(observedBoundary).toBe(null)
        })

        test('unmarked outlet without fallback takes the fast path under an enclosing boundary', async () => {
          let slotBlock!: Block
          let observedBoundary: SlotBoundaryContext | null | undefined
          const markDirty = vi.fn()
          const boundary: SlotBoundaryContext = {
            getParent: () => null,
            getFallback: () => undefined,
            run: fn => fn(),
            markDirty,
            isHolding: NO,
            isHeld: NO,
          }
          const show = ref(true)
          const Comp = defineVaporComponent(() => {
            return (slotBlock = withSlotBoundary(boundary, () =>
              createSlot('default'),
            ))
          })

          const { host } = define(() =>
            createComponent(Comp, null, {
              default: () => {
                observedBoundary = currentRenderContext.slotBoundary
                return createIf(
                  () => show.value,
                  () => template('<span>content</span>')(),
                  undefined,
                  slotRootIfShape,
                )
              },
            }),
          ).render()

          expect(slotBlock).toBeInstanceOf(DynamicFragment)
          expect(slotBlock).not.toBeInstanceOf(SlotFragment)
          // The fast-path fragment captures a null boundary, so content
          // renders outside the enclosing resolution and its marked roots
          // attach no dirty-tracking to it.
          expect(observedBoundary).toBe(null)
          expect(host.innerHTML).toBe(
            '<span>content</span><!--if--><!--slot-->',
          )

          show.value = false
          await nextTick()
          expect(host.innerHTML).toBe('<!--if--><!--slot-->')

          show.value = true
          await nextTick()
          expect(host.innerHTML).toBe(
            '<span>content</span><!--if--><!--slot-->',
          )
          expect(markDirty).not.toHaveBeenCalled()
        })

        test('compiled component outlet inside slot content takes the fast path', async () => {
          const data: any = reactive({ branch: true, show: true })
          let cardBlock: Block | undefined
          const Card = compile(`<template><slot /></template>`, data)
          const CardSpy = extend({}, Card, {
            setup(props: any, ctx: any) {
              return (cardBlock = Card.setup(props, ctx))
            },
          })
          const Receiver = compile(
            `<template><slot><b>receiver fallback</b></slot></template>`,
            data,
          )
          const App = compile(
            `<template>
              <components.Receiver>
                <components.Card v-if="data.branch">
                  <span v-if="data.show">content</span>
                </components.Card>
              </components.Receiver>
            </template>`,
            data,
            { Receiver, Card: CardSpy },
          )

          const { host } = define(() => createComponent(App)).render()

          // Card's own outlet is unmarked and has no fallback, so even under
          // the receiver's boundary it takes the fast path.
          expect(cardBlock).toBeInstanceOf(DynamicFragment)
          expect(cardBlock).not.toBeInstanceOf(SlotFragment)
          expect(host.textContent).toBe('content')

          // The marked v-if at Card's consumer content root updates in place
          // without disturbing the receiver's arbitration.
          data.show = false
          await nextTick()
          expect(host.textContent).toBe('')

          data.branch = false
          await nextTick()
          expect(host.textContent).toBe('receiver fallback')

          data.branch = true
          data.show = true
          await nextTick()
          expect(host.textContent).toBe('content')
        })

        test('compiled outlet with fallback and stable content takes the fast path under a boundary', async () => {
          const data: any = reactive({ branch: true })
          let cardBlock: Block | undefined
          const Card = compile(
            `<template><slot><b>card fallback</b></slot></template>`,
            data,
          )
          const CardSpy = extend({}, Card, {
            setup(props: any, ctx: any) {
              return (cardBlock = Card.setup(props, ctx))
            },
          })
          const Receiver = compile(
            `<template><slot><i>receiver fallback</i></slot></template>`,
            data,
          )
          const App = compile(
            `<template>
              <components.Receiver>
                <components.Card v-if="data.branch">
                  <span>content</span>
                </components.Card>
              </components.Receiver>
            </template>`,
            data,
            { Receiver, Card: CardSpy },
          )

          const { host } = define(() => createComponent(App)).render()

          // Provided stable content keeps Card's local fallback unreachable,
          // so the enclosing boundary does not force the slot fragment.
          expect(cardBlock).not.toBeInstanceOf(SlotFragment)
          expect(host.textContent).toBe('content')

          data.branch = false
          await nextTick()
          expect(host.textContent).toBe('receiver fallback')

          data.branch = true
          await nextTick()
          expect(host.textContent).toBe('content')
        })

        // Coverage guard for the split matrix of shouldUseSlotFragment.
        // The FORWARDED-on-own-template-outlet pairing is synthetic (the
        // compiler only marks forwarded roots inside slot blocks); the split
        // decision reads flags and fallback alone, which is what this pins.
        test('outlets participating in fallback arbitration keep the slot fragment under a boundary', () => {
          let forwardedBlock!: Block
          let fallbackBlock!: Block
          let nonStableFallbackBlock!: Block
          const nonStableSlotFn = (() => template('d')()) as BlockFn
          ;(nonStableSlotFn as any)._ = VaporSlotStability.NON_STABLE
          const boundary: SlotBoundaryContext = {
            getParent: () => null,
            getFallback: () => undefined,
            run: fn => fn(),
            markDirty: vi.fn(),
            isHolding: NO,
            isHeld: NO,
          }
          const Comp = defineVaporComponent(() =>
            withSlotBoundary(boundary, () => [
              (forwardedBlock = createForwardedSlotRoot('a')),
              (fallbackBlock = createSlot('b', null, () =>
                template('fallback')(),
              )),
              (nonStableFallbackBlock = createSlot('d', null, () =>
                template('fallback')(),
              )),
            ]),
          )

          define(() =>
            createComponent(Comp, null, {
              a: () => template('a')(),
              b: () => template('b')(),
              c: () => template('c')(),
              d: nonStableSlotFn,
            }),
          ).render()

          expect(forwardedBlock).toBeInstanceOf(SlotFragment)
          // Local fallback reachability is boundary-independent: a provided
          // stable slot keeps the fallback unreachable, so the fast path
          // applies; a non-stable slot keeps SlotFragment arbitration.
          expect(fallbackBlock).not.toBeInstanceOf(SlotFragment)
          expect(nonStableFallbackBlock).toBeInstanceOf(SlotFragment)
        })

        test('slot with fallback and explicit empty slots', () => {
          let slotBlock!: Block
          const Comp = defineVaporComponent(() => {
            return (slotBlock = createSlot('default', null, () =>
              template('fallback')(),
            ))
          })

          define(() => createComponent(Comp, null, {})).render()

          expect(slotBlock).toBeInstanceOf(DynamicFragment)
          expect(slotBlock).not.toBeInstanceOf(SlotFragment)
        })

        test('slot with fallback and no slots', () => {
          let slotBlock!: Block
          const Comp = defineVaporComponent(() => {
            return (slotBlock = createSlot('default', null, () =>
              template('fallback')(),
            ))
          })

          const { host } = define(() => createComponent(Comp)).render()

          expect(slotBlock).toBeInstanceOf(DynamicFragment)
          expect(slotBlock).not.toBeInstanceOf(SlotFragment)
          expect(host.innerHTML).toBe('fallback<!--slot-->')
        })

        test('stable slot with fallback', () => {
          let slotBlock!: Block
          const slot = (() => template('<p>A</p>')()) as BlockFn
          const Comp = defineVaporComponent(() => {
            return (slotBlock = createSlot('default', null, () =>
              template('fallback')(),
            ))
          })

          const { host } = define(() =>
            createComponent(Comp, null, {
              default: slot,
            }),
          ).render()

          expect(slotBlock).toBeInstanceOf(DynamicFragment)
          expect(slotBlock).not.toBeInstanceOf(SlotFragment)
          expect(host.innerHTML).toBe('<p>A</p><!--slot-->')
        })

        test('non-stable slot with fallback uses slot fragment', () => {
          let slotBlock!: Block
          const slot = (() => template('<p>A</p>')()) as BlockFn
          ;(slot as any)._ = VaporSlotStability.NON_STABLE
          const Comp = defineVaporComponent(() => {
            return (slotBlock = createSlot('default', null, () =>
              template('fallback')(),
            ))
          })

          define(() =>
            createComponent(Comp, null, {
              default: slot,
            }),
          ).render()

          expect(slotBlock).toBeInstanceOf(SlotFragment)
        })

        test('stable component slot with fallback does not render fallback when component output is empty', () => {
          let slotBlock!: Block
          // Component slot content counts as provided even when it renders
          // invalid output, matching VDOM slot fallback semantics.
          const Empty = defineVaporComponent(() =>
            document.createComment('empty'),
          )
          const slot = (() => createComponent(Empty)) as BlockFn
          const Comp = defineVaporComponent(() => {
            return (slotBlock = createSlot('default', null, () =>
              template('fallback')(),
            ))
          })

          const { host } = define(() =>
            createComponent(Comp, null, {
              default: slot,
            }),
          ).render()

          expect(slotBlock).toBeInstanceOf(DynamicFragment)
          expect(slotBlock).not.toBeInstanceOf(SlotFragment)
          expect(host.innerHTML).not.toContain('fallback')
        })

        test('compiled stable sibling keeps fallback hidden when dynamic sibling becomes invalid', async () => {
          const show = ref(true)
          const Child = compile(
            `<template><slot><span>fallback</span></slot></template>`,
            show,
          )
          const Parent = compile(
            `<template>
              <components.Child>
                <span>stable</span>
                <div v-if="data">dynamic</div>
              </components.Child>
            </template>`,
            show,
            { Child },
          )
          const root = document.createElement('div')
          const app = createVaporApp(Parent)
          app.mount(root)

          expect(root.innerHTML).toBe(
            '<span>stable</span><div>dynamic</div><!--if--><!--slot-->',
          )

          show.value = false
          await nextTick()

          expect(root.innerHTML).toBe('<span>stable</span><!--if--><!--slot-->')
        })

        test('compiled component root keeps fallback hidden when component output becomes invalid', async () => {
          const show = ref(true)
          const Child = compile(
            `<template><slot><span>fallback</span></slot></template>`,
            show,
          )
          const Inner = compile(
            `<script setup>
              const props = defineProps(['show'])
            </script>
            <template>
              <span v-if="props.show">inner</span>
            </template>`,
            show,
          )
          const Parent = compile(
            `<template>
              <components.Child>
                <components.Inner :show="data" />
              </components.Child>
            </template>`,
            show,
            { Child, Inner },
          )
          const root = document.createElement('div')
          const app = createVaporApp(Parent)
          app.mount(root)

          expect(root.innerHTML).toBe('<span>inner</span><!--if--><!--slot-->')

          show.value = false
          await nextTick()

          expect(root.innerHTML).toBe('<!--if--><!--slot-->')
        })

        test('compiled root v-if component slot hides fallback when shown even if component output is empty', async () => {
          const show = ref(false)
          const Child = compile(
            `<template><slot><span>fallback</span></slot></template>`,
            show,
          )
          const Empty = compile(
            `<template><span v-if="false">empty</span></template>`,
            show,
          )
          const Parent = compile(
            `<template>
              <components.Child>
                <components.Empty v-if="data" />
              </components.Child>
            </template>`,
            show,
            { Child, Empty },
          )
          const root = document.createElement('div')
          const app = createVaporApp(Parent)
          app.mount(root)

          expect(root.innerHTML).toBe(
            '<!--if--><span>fallback</span><!--slot-->',
          )

          show.value = true
          await nextTick()

          expect(root.innerHTML).toBe('<!--if--><!--if--><!--slot-->')
        })

        test('recomputes validity for all-dynamic multi-root slot content', async () => {
          const data = ref('both')
          const Child = compile(
            `<template><slot><span>fallback</span></slot></template>`,
            data,
          )
          const Parent = compile(
            `<template>
              <components.Child>
                <span v-if="data !== 'none' && data !== 'second'">first</span>
                <div v-if="data !== 'none' && data !== 'first'">second</div>
              </components.Child>
            </template>`,
            data,
            { Child },
          )
          const root = document.createElement('div')
          const app = createVaporApp(Parent)
          app.mount(root)

          expect(root.innerHTML).toContain('<span>first</span>')
          expect(root.innerHTML).toContain('<div>second</div>')
          expect(root.innerHTML).not.toContain('fallback')

          data.value = 'first'
          await nextTick()

          expect(root.innerHTML).toContain('<span>first</span>')
          expect(root.innerHTML).not.toContain('second')
          expect(root.innerHTML).not.toContain('fallback')

          data.value = 'none'
          await nextTick()

          expect(root.innerHTML).toBe(
            '<!--if--><!--if--><span>fallback</span><!--slot-->',
          )

          data.value = 'second'
          await nextTick()

          expect(root.innerHTML).toContain('<div>second</div>')
          expect(root.innerHTML).not.toContain('first')
          expect(root.innerHTML).not.toContain('fallback')
        })

        test('recomputes validity for v-for and v-if slot roots', async () => {
          const data = ref({ items: ['one'], show: true })
          const Child = compile(
            `<template><slot><span>fallback</span></slot></template>`,
            data,
          )
          const Parent = compile(
            `<template>
              <components.Child>
                <span v-for="item in data.items">{{ item }}</span>
                <div v-if="data.show">tail</div>
              </components.Child>
            </template>`,
            data,
            { Child },
          )
          const root = document.createElement('div')
          const app = createVaporApp(Parent)
          app.mount(root)

          expect(root.innerHTML).toContain('<span>one</span>')
          expect(root.innerHTML).toContain('<div>tail</div>')
          expect(root.innerHTML).not.toContain('fallback')

          data.value = { items: [], show: true }
          await nextTick()

          expect(root.innerHTML).toContain('<div>tail</div>')
          expect(root.innerHTML).not.toContain('fallback')

          data.value = { items: [], show: false }
          await nextTick()

          expect(root.innerHTML).toBe(
            '<!--for--><!--if--><span>fallback</span><!--slot-->',
          )

          data.value = { items: ['two'], show: false }
          await nextTick()

          expect(root.innerHTML).toContain('<span>two</span>')
          expect(root.innerHTML).not.toContain('fallback')
        })
      })

      describe('hydration', () => {
        test('plain slot without fallback', () => {
          let slotBlock!: Block
          const container = document.createElement('div')
          container.innerHTML = '<!--[-->content<!--]-->'
          const Comp = defineVaporComponent(() => {
            return (slotBlock = createSlot('default'))
          })

          createVaporSSRApp(
            defineVaporComponent(() =>
              createComponent(Comp, null, {
                default: () => template('content')(),
              }),
            ),
          ).mount(container)

          expect(slotBlock).toBeInstanceOf(DynamicFragment)
          expect(slotBlock).not.toBeInstanceOf(SlotFragment)
          expect(container.innerHTML).toBe('<!--[-->content<!--]-->')
        })

        test('slot with fallback and no slots', () => {
          let slotBlock!: Block
          const container = document.createElement('div')
          container.innerHTML = '<!--[-->fallback<!--]-->'
          const Comp = defineVaporComponent(() => {
            return (slotBlock = createSlot('default', null, () =>
              template('fallback')(),
            ))
          })

          createVaporSSRApp(
            defineVaporComponent(() => createComponent(Comp)),
          ).mount(container)

          expect(slotBlock).toBeInstanceOf(DynamicFragment)
          expect(slotBlock).not.toBeInstanceOf(SlotFragment)
          expect(container.innerHTML).toBe('<!--[-->fallback<!--]-->')
        })

        test('stable slot with fallback', () => {
          let slotBlock!: Block
          const container = document.createElement('div')
          container.innerHTML = '<!--[--><p>A</p><!--]-->'
          const slot = (() => template('<p>A</p>')()) as BlockFn
          const Comp = defineVaporComponent(() => {
            return (slotBlock = createSlot('default', null, () =>
              template('fallback')(),
            ))
          })

          createVaporSSRApp(
            defineVaporComponent(() =>
              createComponent(Comp, null, {
                default: slot,
              }),
            ),
          ).mount(container)

          expect(slotBlock).toBeInstanceOf(DynamicFragment)
          expect(slotBlock).not.toBeInstanceOf(SlotFragment)
          expect(container.innerHTML).toBe('<!--[--><p>A</p><!--]-->')
        })

        test('forwarded empty slot without consuming following sibling', () => {
          let slotBlock!: Block
          const Child = defineVaporComponent({
            setup() {
              return [
                template('<main>content</main>')(),
                (slotBlock = createSlot('footer')),
                template('<p>after</p>')(),
              ]
            },
          })
          const Parent = defineVaporComponent({
            setup() {
              return createComponent(Child, null, {
                footer: () => createSlot('footer'),
              })
            },
          })
          const container = document.createElement('div')
          container.innerHTML =
            '<!--[--><main>content</main><!--[--><!--]--><p>after</p><!--]-->'

          createVaporSSRApp(
            defineVaporComponent(() => createComponent(Parent)),
          ).mount(container)

          expect(slotBlock).toBeInstanceOf(DynamicFragment)
          expect(slotBlock).not.toBeInstanceOf(SlotFragment)
          expect(container.innerHTML).toBe(
            '<!--[--><main>content</main><!--[--><!--]--><!--slot--><p>after</p><!--]-->',
          )
          expect(`Hydration node mismatch`).not.toHaveBeenWarned()
          expect(`Hydration children mismatch`).not.toHaveBeenWarned()
        })
      })
    })
  })

  describe('forwarded slot', () => {
    test('should work', async () => {
      const Child = defineVaporComponent({
        setup() {
          return createSlot('foo', null)
        },
      })
      const Parent = defineVaporComponent({
        setup() {
          const n2 = createComponent(
            Child,
            null,
            {
              foo: () => {
                return createSlot('foo', null)
              },
            },
            true,
          )
          return n2
        },
      })

      const foo = ref('foo')
      const { host } = define({
        setup() {
          const n2 = createComponent(
            Parent,
            null,
            {
              foo: () => {
                const n0 = template(' ')() as any
                renderEffect(() => setText(n0, foo.value))
                return n0
              },
            },
            true,
          )
          return n2
        },
      }).render()

      expect(host.innerHTML).toBe('foo<!--slot--><!--slot-->')

      foo.value = 'bar'
      await nextTick()
      expect(host.innerHTML).toBe('bar<!--slot--><!--slot-->')
    })

    test('mixed with non-forwarded slot', async () => {
      const Child = defineVaporComponent({
        setup() {
          return [createSlot('foo', null)]
        },
      })
      const Parent = defineVaporComponent({
        setup() {
          const n2 = createComponent(Child, null, {
            foo: () => {
              const n0 = createSlot('foo', null)
              return n0
            },
          })
          const n3 = createSlot('default', null)
          return [n2, n3]
        },
      })

      const foo = ref('foo')
      const { host } = define({
        setup() {
          const n2 = createComponent(
            Parent,
            null,
            {
              foo: () => {
                const n0 = template(' ')() as any
                renderEffect(() => setText(n0, foo.value))
                return n0
              },
              default: () => {
                const n3 = template(' ')() as any
                renderEffect(() => setText(n3, foo.value))
                return n3
              },
            },
            true,
          )
          return n2
        },
      }).render()

      expect(host.innerHTML).toBe('foo<!--slot--><!--slot-->foo<!--slot-->')

      foo.value = 'bar'
      await nextTick()
      expect(host.innerHTML).toBe('bar<!--slot--><!--slot-->bar<!--slot-->')
    })

    test('forwarded slot with fallback', async () => {
      const Child = defineVaporComponent({
        setup() {
          return createSlot('default', null, () => template('child fallback')())
        },
      })

      const Parent = defineVaporComponent({
        setup() {
          const n2 = createComponent(Child, null, {
            default: extend(() => {
              const n0 = createForwardedSlotRoot('default', () =>
                template('<!-- <div></div> -->')(),
              )
              return n0
            }, nonStableSlot),
          })
          return n2
        },
      })

      const { html } = define({
        setup() {
          return createComponent(Parent, null, {
            default: extend(
              () => template('<!-- <div>App</div> -->')(),
              nonStableSlot,
            ),
          })
        },
      }).render()

      expect(html()).toBe(
        '<!-- <div>App</div> --><!-- <div></div> --><!--slot-->child fallback<!--slot-->',
      )
    })

    test('named forwarded slot with v-if', async () => {
      const Child = defineVaporComponent({
        setup() {
          return createSlot('default', null)
        },
      })

      const Parent = defineVaporComponent({
        props: {
          show: Boolean,
        },
        setup(props) {
          const n6 = createComponent(
            Child,
            null,
            {
              default: () => {
                const n0 = createIf(
                  () => props.show,
                  () => {
                    const n5 = template('<div></div>')() as any
                    setInsertionState(n5)
                    createSlot('header', null, () => {
                      const n4 = template('default header')()
                      return n4
                    })
                    return n5
                  },
                  undefined,
                  keyedSlotRootIfShape,
                )
                return n0
              },
            },
            true,
          )
          return n6
        },
      })

      const show = ref(false)
      const { html } = define({
        setup() {
          return createComponent(
            Parent,
            {
              show: () => show.value,
            },
            {
              header: () => template('custom header')(),
            },
          )
        },
      }).render()

      expect(html()).toBe('<!--if--><!--slot-->')

      show.value = true
      await nextTick()
      expect(html()).toBe(
        '<div>custom header<!--slot--></div><!--if--><!--slot-->',
      )

      show.value = false
      await nextTick()
      expect(html()).toBe('<!--if--><!--slot-->')
    })

    test('forwarded slot with fallback (v-if)', async () => {
      const Child = defineVaporComponent({
        setup() {
          return createSlot('default', null, () => template('child fallback')())
        },
      })

      const show = ref(false)
      const Parent = defineVaporComponent({
        setup() {
          const n2 = createComponent(Child, null, {
            default: extend(() => {
              const n0 = createForwardedSlotRoot('default', () => {
                const n2 = createIf(
                  () => show.value,
                  () => {
                    const n4 = template('<div>if content</div>')()
                    return n4
                  },
                  undefined,
                  keyedSlotRootIfShape,
                )
                return n2
              })
              return n0
            }, nonStableSlot),
          })
          return n2
        },
      })

      const { html } = define({
        setup() {
          return createComponent(Parent, null, {
            default: extend(
              () => template('<!-- <div>App</div> -->')(),
              nonStableSlot,
            ),
          })
        },
      }).render()

      expect(html()).toBe(
        '<!-- <div>App</div> --><!--if--><!--slot-->child fallback<!--slot-->',
      )

      show.value = true
      await nextTick()
      expect(html()).toBe(
        '<!-- <div>App</div> --><div>if content</div><!--if--><!--slot--><!--slot-->',
      )
    })

    test('forwarded slot with fallback (v-for)', async () => {
      const Child = defineVaporComponent({
        setup() {
          return createSlot('default', null, () => template('child fallback')())
        },
      })

      const items = ref<number[]>([])
      const Parent = defineVaporComponent({
        setup() {
          const n2 = createComponent(Child, null, {
            default: extend(() => {
              const n0 = createForwardedSlotRoot('default', () => {
                const n2 = createFor(
                  () => items.value,
                  for_item0 => {
                    const n4 = template('<span> </span>')() as any
                    const x4 = child(n4) as any
                    renderEffect(() =>
                      setText(x4, toDisplayString(for_item0.value)),
                    )
                    return n4
                  },
                  undefined,
                  slotRootForFlags,
                )
                return n2
              })
              return n0
            }, nonStableSlot),
          })
          return n2
        },
      })

      const { html } = define({
        setup() {
          return createComponent(Parent, null, {
            default: extend(
              () => template('<!-- <div>App</div> -->')(),
              nonStableSlot,
            ),
          })
        },
      }).render()

      expect(html()).toBe(
        '<!-- <div>App</div> --><!--for--><!--slot-->child fallback<!--slot-->',
      )

      items.value.push(1)
      await nextTick()
      expect(html()).toBe(
        '<!-- <div>App</div> --><span>1</span><!--for--><!--slot--><!--slot-->',
      )

      items.value.pop()
      await nextTick()
      await nextTick()
      expect(html()).toBe(
        '<!-- <div>App</div> --><!--for--><!--slot-->child fallback<!--slot-->',
      )
    })

    test('consecutive slots with insertion state', async () => {
      const { component: Child } = define({
        setup() {
          const n2 = template('<div><!><!><div>baz</div></div>', 1)() as any
          const a0 = child(n2)
          const a1 = next(a0)
          setInsertionState(n2, a0)
          createSlot('default', null)
          setInsertionState(n2, a1)
          createSlot('foo', null)
          return n2
        },
      })

      const { html } = define({
        setup() {
          return createComponent(Child, null, {
            default: () => template('default')(),
            foo: () => template('foo')(),
          })
        },
      }).render()

      expect(html()).toBe(
        `<div>` +
          `default<!--slot-->` +
          `foo<!--slot-->` +
          `<div>baz</div>` +
          `</div>`,
      )
    })

    describe('vdom interop', () => {
      test('appended outlet renders interop slot content', () => {
        // regression: interop slot fragments have no client anchor and append
        // outlets capture no insertion anchor — undefined === undefined must
        // not read as adoption, which skipped the only insertion
        const VaporChild = defineVaporComponent({
          setup() {
            const n = template('<div></div>', 1)() as any
            setInsertionState(n)
            createSlot('default', null)
            return n
          },
        })
        const root = document.createElement('div')
        const app = createApp({
          render: () =>
            h(VaporChild as any, null, { default: () => h('span', 'hi') }),
        })
        app.use(vaporInteropPlugin)
        app.mount(root)
        expect(root.innerHTML).toContain('<span>hi</span>')
        app.unmount()
      })

      const createVaporSlot = (fallbackText = 'fallback') => {
        return defineVaporComponent({
          setup() {
            const n0 = createSlot('foo', null, () => {
              const n2 = template(`<div>${fallbackText}</div>`)()
              return n2
            })
            return n0
          },
        })
      }

      const createVdomSlot = (fallbackText = 'fallback') => {
        return {
          render(this: any) {
            return renderSlot(this.$slots, 'foo', {}, () => [
              h('div', fallbackText),
            ])
          },
        }
      }

      const createVaporForwardedSlot = (
        targetComponent: any,
        fallbackText?: string,
      ) => {
        return defineVaporComponent({
          setup() {
            const n2 = createComponent(
              targetComponent,
              null,
              {
                foo: extend(() => {
                  return fallbackText
                    ? createForwardedSlotRoot('foo', () => {
                        const n2 = template(`<div>${fallbackText}</div>`)()
                        return n2
                      })
                    : createForwardedSlotRoot('foo')
                }, nonStableSlot),
              },
              true,
            )
            return n2
          },
        })
      }

      const createVdomForwardedSlot = (
        targetComponent: any,
        fallbackText?: string,
      ) => {
        return {
          render(this: any) {
            return h(targetComponent, null, {
              foo: () => [
                fallbackText
                  ? renderSlot(this.$slots, 'foo', {}, () => [
                      h('div', fallbackText),
                    ])
                  : renderSlot(this.$slots, 'foo'),
              ],
              _: 3 /* FORWARDED */,
            })
          },
        }
      }

      const createMultipleVaporForwardedSlots = (
        targetComponent: any,
        count: number,
      ) => {
        let current = targetComponent
        for (let i = 0; i < count; i++) {
          current = createVaporForwardedSlot(current)
        }
        return current
      }

      const createMultipleVdomForwardedSlots = (
        targetComponent: any,
        count: number,
      ) => {
        let current = targetComponent
        for (let i = 0; i < count; i++) {
          current = createVdomForwardedSlot(current)
        }
        return current
      }

      const createTestApp = (
        rootComponent: any,
        foo: Ref<string>,
        show: Ref<boolean>,
      ) => {
        return {
          setup() {
            return () =>
              h(
                rootComponent,
                null,
                createSlots({ _: 2 /* DYNAMIC */ } as any, [
                  show.value
                    ? {
                        name: 'foo',
                        fn: () => [h('span', foo.value)],
                        key: '0',
                      }
                    : undefined,
                ]),
              )
          },
        }
      }

      const createEmptyTestApp = (rootComponent: any) => {
        return {
          setup() {
            return () => h(rootComponent)
          },
        }
      }

      test('vdom slot > vapor forwarded slot > vapor slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VaporSlot = createVaporSlot()
        const VaporForwardedSlot = createVaporForwardedSlot(VaporSlot)
        const App = createTestApp(VaporForwardedSlot, foo, show)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span><!--slot-->')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot-->')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<div>fallback</div><!--slot-->')
      })

      test('vdom slot > vapor forwarded slot(with fallback) > vapor slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VaporSlot = createVaporSlot()
        const VaporForwardedSlotWithFallback = createVaporForwardedSlot(
          VaporSlot,
          'forwarded fallback',
        )
        const App = createTestApp(VaporForwardedSlotWithFallback, foo, show)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span><!--slot-->')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot-->')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<div>forwarded fallback</div><!--slot-->')
      })

      test('vdom slot > vapor forwarded slot > vdom slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VdomSlot = createVdomSlot()
        const VaporForwardedSlot = createVaporForwardedSlot(VdomSlot)
        const App = createTestApp(VaporForwardedSlot, foo, show)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span>')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span>')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<div>fallback</div>')

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span>')
      })

      test('vdom slot > vapor forwarded slot(with fallback) > vdom slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VdomSlot = createVdomSlot()
        const VaporForwardedSlotWithFallback = createVaporForwardedSlot(
          VdomSlot,
          'forwarded fallback',
        )
        const App = createTestApp(VaporForwardedSlotWithFallback, foo, show)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span>')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span>')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<div>forwarded fallback</div>')
      })

      test('vdom slot > vapor forwarded slot > vdom forwarded slot > vapor slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VaporSlot = createVaporSlot()
        const VdomForwardedSlot = createVdomForwardedSlot(VaporSlot)
        const VaporForwardedSlot = createVaporForwardedSlot(VdomForwardedSlot)
        const App = createTestApp(VaporForwardedSlot, foo, show)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span>')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span>')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<div>fallback</div>')

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span>')
      })

      test('vdom slot > vapor forwarded slot(with fallback) > vdom forwarded slot > vapor slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VaporSlot = createVaporSlot()
        const VdomForwardedSlot = createVdomForwardedSlot(VaporSlot)
        const VaporForwardedSlotWithFallback = createVaporForwardedSlot(
          VdomForwardedSlot,
          'forwarded fallback',
        )
        const App = createTestApp(VaporForwardedSlotWithFallback, foo, show)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span>')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span>')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<div>forwarded fallback</div>')

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span>')
      })

      test('vdom slot > vapor forwarded slot > vdom forwarded slot(with fallback) > vapor slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VaporSlot = createVaporSlot()
        const VdomForwardedSlotWithFallback = createVdomForwardedSlot(
          VaporSlot,
          'vdom fallback',
        )
        const VaporForwardedSlot = createVaporForwardedSlot(
          VdomForwardedSlotWithFallback,
        )
        const App = createTestApp(VaporForwardedSlot, foo, show)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span>')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span>')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<div>vdom fallback</div>')

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span>')
      })

      test('vdom slot(empty) > vapor forwarded slot > vdom forwarded slot(with fallback) > vapor slot', async () => {
        const VaporSlot = createVaporSlot()
        const VdomForwardedSlotWithFallback = createVdomForwardedSlot(
          VaporSlot,
          'vdom fallback',
        )
        const VaporForwardedSlot = createVaporForwardedSlot(
          VdomForwardedSlotWithFallback,
        )
        const App = createEmptyTestApp(VaporForwardedSlot)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<div>vdom fallback</div>')
      })

      test('vdom forwarded fallback updates existing vapor slot block', async () => {
        const fallbackText = ref('fallback')

        const VdomForwardedSlotWithReactiveFallback = {
          render(this: any) {
            return renderSlot(this.$slots, 'foo', {}, () => [
              h('div', fallbackText.value),
            ])
          },
        }
        const VaporForwardedSlot = createVaporForwardedSlot(
          VdomForwardedSlotWithReactiveFallback,
        )
        const App = createEmptyTestApp(VaporForwardedSlot)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<div>fallback</div>')

        fallbackText.value = 'updated'
        await nextTick()
        expect(root.innerHTML).toBe('<div>updated</div>')
      })

      test('vdom forwarded fallback updates when fallback function identity changes', async () => {
        const useAlt = ref(false)

        const VdomForwardedSlotWithDynamicFallback = {
          render(this: any) {
            const tag = useAlt.value ? 'p' : 'div'
            const text = useAlt.value ? 'alt fallback' : 'fallback'
            return renderSlot(this.$slots, 'foo', {}, () => [h(tag, text)])
          },
        }
        const VaporForwardedSlot = createVaporForwardedSlot(
          VdomForwardedSlotWithDynamicFallback,
        )
        const App = createEmptyTestApp(VaporForwardedSlot)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<div>fallback</div>')

        useAlt.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<p>alt fallback</p>')
      })

      test('vdom forwarded fallback identity switch disposes stale fallback effects', async () => {
        const useAlt = ref(false)
        const primaryText = ref('fallback')
        const altText = ref('alt fallback')

        const VdomForwardedSlotWithDynamicFallback = {
          render(this: any) {
            return renderSlot(
              this.$slots,
              'foo',
              {},
              useAlt.value
                ? () => [h('p', altText.value)]
                : () => [h('div', primaryText.value)],
            )
          },
        }
        const VaporForwardedSlot = createVaporForwardedSlot(
          VdomForwardedSlotWithDynamicFallback,
        )
        const App = createEmptyTestApp(VaporForwardedSlot)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<div>fallback</div>')

        useAlt.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<p>alt fallback</p>')

        primaryText.value = 'stale fallback'
        await nextTick()
        expect(root.innerHTML).toBe('<p>alt fallback</p>')

        altText.value = 'active fallback'
        await nextTick()
        expect(root.innerHTML).toBe('<p>active fallback</p>')
      })

      test('vdom fallback updates when renderVaporSlot returns slot fragment', async () => {
        const useAlt = ref(false)

        const VdomSlotWithDynamicFallback = {
          render(this: any) {
            const tag = useAlt.value ? 'p' : 'div'
            const text = useAlt.value ? 'alt fallback' : 'fallback'
            return renderSlot(this.$slots, 'foo', {}, () => [h(tag, text)])
          },
        }

        const VaporForwardedSlot = defineVaporComponent({
          setup() {
            return createComponent(
              VdomSlotWithDynamicFallback,
              null,
              {
                foo: () => createForwardedSlotRoot('foo'),
              },
              true,
            )
          },
        })

        const root = document.createElement('div')
        createVaporApp(VaporForwardedSlot).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<!--slot--><div>fallback</div>')

        useAlt.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<!--slot--><p>alt fallback</p>')
      })

      test('vdom fallback ownership ignores fast-path outlet fragments', async () => {
        const text = ref('fallback')

        const VdomSlotWithFallback = {
          render(this: any) {
            return renderSlot(this.$slots, 'foo', {}, () => [
              h('div', text.value),
            ])
          },
        }

        const VaporParent = defineVaporComponent({
          setup() {
            return createComponent(
              VdomSlotWithFallback,
              null,
              // Unmarked outlet without fallback: a fast-path DynamicFragment,
              // which must not be mistaken for a SlotFragment that could own
              // the vdom fallback decision. Hand-written on purpose: the
              // compiler marks every root outlet FORWARDED, so this shape is
              // only reachable through hand-written render functions.
              { foo: () => createSlot('foo') },
              true,
            )
          },
        })

        const root = document.createElement('div')
        createVaporApp(VaporParent).use(vaporInteropPlugin).mount(root)
        expect(root.textContent).toBe('fallback')

        text.value = 'updated fallback'
        await nextTick()
        expect(root.textContent).toBe('updated fallback')
      })

      test('vdom fallback for renderVaporSlot is evaluated once on initial mount', async () => {
        const fallbackText = ref('fallback')
        const fallbackSpy = vi.fn(() => [h('div', fallbackText.value)])

        const VdomSlotWithCountingFallback = {
          render(this: any) {
            return renderSlot(this.$slots, 'foo', {}, fallbackSpy)
          },
        }

        const VaporForwardedSlot = defineVaporComponent({
          setup() {
            return createComponent(
              VdomSlotWithCountingFallback,
              null,
              {
                foo: () => createForwardedSlotRoot('foo'),
              },
              true,
            )
          },
        })

        const root = document.createElement('div')
        createVaporApp(VaporForwardedSlot).use(vaporInteropPlugin).mount(root)

        expect(root.innerHTML).toBe('<!--slot--><div>fallback</div>')
        expect(fallbackSpy).toHaveBeenCalledTimes(1)

        fallbackText.value = 'updated fallback'
        await nextTick()

        expect(root.innerHTML).toBe('<!--slot--><div>updated fallback</div>')
        expect(fallbackSpy).toHaveBeenCalledTimes(2)
      })

      test('vdom fallback for renderVaporSlot supports text children', async () => {
        const fallbackText = ref('fallback')
        const fallbackSpy = vi.fn(() => [fallbackText.value])

        const VdomSlotWithTextFallback = {
          render(this: any) {
            return renderSlot(this.$slots, 'foo', {}, fallbackSpy)
          },
        }

        const VaporForwardedSlot = defineVaporComponent({
          setup() {
            return createComponent(
              VdomSlotWithTextFallback,
              null,
              {
                foo: () => createForwardedSlotRoot('foo'),
              },
              true,
            )
          },
        })

        const root = document.createElement('div')
        createVaporApp(VaporForwardedSlot).use(vaporInteropPlugin).mount(root)

        expect(root.innerHTML).toBe('<!--slot-->fallback')
        expect(fallbackSpy).toHaveBeenCalledTimes(1)

        fallbackText.value = 'updated fallback'
        await nextTick()

        expect(root.innerHTML).toBe('<!--slot-->updated fallback')
        expect(fallbackSpy).toHaveBeenCalledTimes(2)
      })

      test('moving active vdom fallback keeps slot anchor order after teleport move', async () => {
        const targetA = document.createElement('div')
        targetA.id = 'component-slots-fallback-target-a'
        const targetB = document.createElement('div')
        targetB.id = 'component-slots-fallback-target-b'
        document.body.append(targetA, targetB)

        const to = ref('#component-slots-fallback-target-a')
        const fallbackText = ref('fallback')

        try {
          const VdomSlotWithReactiveFallback = {
            render(this: any) {
              return renderSlot(this.$slots, 'foo', {}, () => [
                h('div', fallbackText.value),
              ])
            },
          }

          const VaporTeleportedSlot = defineVaporComponent({
            setup() {
              return createComponent(
                VaporTeleport,
                {
                  to: () => to.value,
                },
                {
                  default: () =>
                    createComponent(
                      VdomSlotWithReactiveFallback,
                      null,
                      {
                        foo: () => createForwardedSlotRoot('foo'),
                      },
                      true,
                    ),
                },
              )
            },
          })

          const host = document.createElement('div')
          const app = createVaporApp(VaporTeleportedSlot)
          app.use(vaporInteropPlugin)
          app.mount(host)
          await nextTick()

          expect(targetA.innerHTML).toBe('<!--slot--><div>fallback</div>')
          expect(targetB.innerHTML).toBe('')

          to.value = '#component-slots-fallback-target-b'
          await nextTick()

          expect(targetA.innerHTML).toBe('')
          expect(targetB.innerHTML).toBe('<!--slot--><div>fallback</div>')

          fallbackText.value = 'moved fallback'
          await nextTick()

          expect(targetB.innerHTML).toBe('<!--slot--><div>moved fallback</div>')

          app.unmount()
        } finally {
          targetA.remove()
          targetB.remove()
        }
      })

      test('vdom fallback removal clears the fallback rendered for a vapor slot', async () => {
        const useFallback = ref(true)

        const VdomSlotWithOptionalFallback = {
          render(this: any) {
            return renderSlot(
              this.$slots,
              'foo',
              {},
              useFallback.value ? () => [h('div', 'fallback')] : undefined,
            )
          },
        }

        const VaporForwardedSlot = defineVaporComponent({
          setup() {
            return createComponent(
              VdomSlotWithOptionalFallback,
              null,
              {
                foo: () => createForwardedSlotRoot('foo'),
              },
              true,
            )
          },
        })

        const root = document.createElement('div')
        createVaporApp(VaporForwardedSlot).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<!--slot--><div>fallback</div>')

        useFallback.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<!--slot-->')
      })

      test('vdom fallback can update to empty without crashing', async () => {
        const showFallback = ref(true)

        const VdomSlotWithReactiveFallback = {
          render(this: any) {
            return renderSlot(this.$slots, 'foo', {}, () =>
              showFallback.value ? [h('div', 'fallback')] : [],
            )
          },
        }

        const VaporForwardedSlot = defineVaporComponent({
          setup() {
            return createComponent(
              VdomSlotWithReactiveFallback,
              null,
              {
                foo: () => createForwardedSlotRoot('foo'),
              },
              true,
            )
          },
        })

        const root = document.createElement('div')
        createVaporApp(VaporForwardedSlot).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<!--slot--><div>fallback</div>')

        showFallback.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<!--slot-->')

        showFallback.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<!--slot--><div>fallback</div>')
      })

      test('vdom fallback removal clears active wrapper fallback for non-slot-fragment content', async () => {
        const useFallback = ref(true)
        const show = ref(false)

        const VdomSlotWithOptionalFallback = {
          render(this: any) {
            return renderSlot(
              this.$slots,
              'foo',
              {},
              useFallback.value ? () => [h('div', 'fallback')] : undefined,
            )
          },
        }

        const VaporForwardedSlot = defineVaporComponent({
          setup() {
            return createComponent(
              VdomSlotWithOptionalFallback,
              null,
              {
                foo: () =>
                  createIf(
                    () => show.value,
                    () => template('<span>content</span>')(),
                  ),
              },
              true,
            )
          },
        })

        const root = document.createElement('div')
        createVaporApp(VaporForwardedSlot).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<!--if--><div>fallback</div>')

        // with no fallback left, the content is exposed again
        useFallback.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<!--if-->')

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<span>content</span><!--if-->')
      })

      test('vdom fallback toggles between local and outer fallback for non-slot-fragment content', async () => {
        const useFallback = ref(true)
        const VaporSlot = createVaporSlot('outer fallback')

        const VdomForwardedSlotWithOptionalFallback = {
          render(this: any) {
            return h(VaporSlot, null, {
              foo: () => [
                renderSlot(
                  this.$slots,
                  'foo',
                  {},
                  useFallback.value
                    ? () => [h('div', 'local fallback')]
                    : undefined,
                ),
              ],
              _: 3 /* FORWARDED */,
            })
          },
        }

        const VaporForwardedSlot = defineVaporComponent({
          setup() {
            return createComponent(
              VdomForwardedSlotWithOptionalFallback,
              null,
              {
                foo: () =>
                  createIf(
                    () => false,
                    () => template('<span>content</span>')(),
                  ),
              },
              true,
            )
          },
        })

        const root = document.createElement('div')
        createVaporApp(VaporForwardedSlot).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<!--if--><div>local fallback</div>')

        useFallback.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<!--if--><div>outer fallback</div>')

        useFallback.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<!--if--><div>local fallback</div>')
      })

      test('nested interop vapor slot fallback should satisfy enclosing vapor slot validity after content becomes invalid', async () => {
        const showContent = ref(true)
        const OuterVaporSlot = createVaporSlot('outer fallback')

        const VdomSlotWithLocalFallback = {
          render(this: any) {
            return renderSlot(this.$slots, 'bar', {}, () => [
              h('div', 'local fallback'),
            ])
          },
        }

        const NestedInteropContainer = defineVaporComponent({
          setup() {
            return createComponent(
              VdomSlotWithLocalFallback,
              null,
              {
                bar: () =>
                  createIf(
                    () => showContent.value,
                    () => template('<span>content</span>')(),
                    undefined,
                    slotRootIfShape,
                  ),
              },
              true,
            )
          },
        })

        const App = defineVaporComponent({
          setup() {
            return createComponent(
              OuterVaporSlot,
              null,
              {
                foo: () => createComponent(NestedInteropContainer, null, null),
              },
              true,
            )
          },
        })

        const root = document.createElement('div')
        createVaporApp(App).use(vaporInteropPlugin).mount(root)
        await nextTick()
        expect(root.innerHTML).toBe('<span>content</span><!--if--><!--slot-->')

        showContent.value = false
        await nextTick()
        expect(root.innerHTML).toBe(
          '<!--if--><div>local fallback</div><!--slot-->',
        )
      })

      test('vdom fallback addition activates the fallback rendered for a vapor slot', async () => {
        const useFallback = ref(false)

        const VdomSlotWithOptionalFallback = {
          render(this: any) {
            return renderSlot(
              this.$slots,
              'foo',
              {},
              useFallback.value ? () => [h('div', 'fallback')] : undefined,
            )
          },
        }

        const VaporForwardedSlot = defineVaporComponent({
          setup() {
            return createComponent(
              VdomSlotWithOptionalFallback,
              null,
              {
                foo: () => createForwardedSlotRoot('foo'),
              },
              true,
            )
          },
        })

        const root = document.createElement('div')
        createVaporApp(VaporForwardedSlot).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<!--slot-->')

        useFallback.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<!--slot--><div>fallback</div>')
      })

      test('vdom fallback addition should not remount valid forwarded vapor content', async () => {
        const useFallback = ref(false)
        const mountSpy = vi.fn()

        const Content = defineVaporComponent({
          setup() {
            mountSpy()
            return template('<span>content</span>')()
          },
        })

        const VdomSlotWithOptionalFallback = {
          render(this: any) {
            return renderSlot(
              this.$slots,
              'foo',
              {},
              useFallback.value ? () => [h('div', 'fallback')] : undefined,
            )
          },
        }

        const VaporForwardedSlot = defineVaporComponent({
          setup() {
            return createComponent(
              VdomSlotWithOptionalFallback,
              null,
              {
                foo: () => createComponent(Content, null, null),
              },
              true,
            )
          },
        })

        const root = document.createElement('div')
        createVaporApp(VaporForwardedSlot).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>content</span>')
        expect(mountSpy).toHaveBeenCalledTimes(1)

        useFallback.value = true
        await nextTick()

        expect(root.innerHTML).toBe('<span>content</span>')
        expect(mountSpy).toHaveBeenCalledTimes(1)
      })

      test('vdom fallback added over forwarded vapor component content stays hidden when component output becomes invalid', async () => {
        const useFallback = ref(false)
        const showContent = ref(true)
        const mountSpy = vi.fn()

        const Content = defineVaporComponent({
          setup() {
            mountSpy()
            return createIf(
              () => showContent.value,
              () => template('<span>content</span>')(),
              undefined,
              keyedSlotRootIfShape,
            )
          },
        })

        const VdomSlotWithOptionalFallback = {
          render(this: any) {
            return renderSlot(
              this.$slots,
              'foo',
              {},
              useFallback.value ? () => [h('div', 'fallback')] : undefined,
            )
          },
        }

        const VaporForwardedSlot = defineVaporComponent({
          setup() {
            return createComponent(
              VdomSlotWithOptionalFallback,
              null,
              {
                foo: () => createComponent(Content, null, null),
              },
              true,
            )
          },
        })

        const root = document.createElement('div')
        createVaporApp(VaporForwardedSlot).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>content</span><!--if-->')
        expect(mountSpy).toHaveBeenCalledTimes(1)

        useFallback.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<span>content</span><!--if-->')
        expect(mountSpy).toHaveBeenCalledTimes(1)

        showContent.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<!--if-->')
        expect(mountSpy).toHaveBeenCalledTimes(1)
      })

      test('vdom fallback added over forwarded vapor slot fragments should activate when slot content later becomes invalid', async () => {
        const useFallback = ref(false)
        const foo = ref('content')
        const showContent = ref(true)

        const VdomSlotWithOptionalFallback = {
          render(this: any) {
            return renderSlot(
              this.$slots,
              'foo',
              {},
              useFallback.value ? () => [h('div', 'fallback')] : undefined,
            )
          },
        }

        const VaporForwardedSlot = defineVaporComponent({
          setup() {
            return createComponent(
              VdomSlotWithOptionalFallback,
              null,
              {
                foo: () => createForwardedSlotRoot('foo'),
              },
              true,
            )
          },
        })

        const App = createTestApp(VaporForwardedSlot, foo, showContent)
        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>content</span>')

        useFallback.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<span>content</span>')

        showContent.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<div>fallback</div>')
      })

      test('vdom fallback added later does not propagate through stable slot content', async () => {
        const useFallback = ref(false)
        const showInner = ref(true)

        const NestedSlotContainer = defineVaporComponent({
          setup() {
            return [template('<span>stable</span>')(), createSlot('bar', null)]
          },
        })

        const VdomSlotWithOptionalFallback = {
          render(this: any) {
            return renderSlot(
              this.$slots,
              'foo',
              {},
              useFallback.value
                ? () => [h('div', 'outer fallback')]
                : undefined,
            )
          },
        }

        const VaporForwardedSlot = defineVaporComponent({
          setup() {
            return createComponent(
              VdomSlotWithOptionalFallback,
              null,
              {
                foo: () =>
                  createComponent(
                    NestedSlotContainer,
                    null,
                    {
                      bar: () =>
                        createIf(
                          () => showInner.value,
                          () => template('<i>inner</i>')(),
                          undefined,
                          slotRootIfShape,
                        ),
                    },
                    true,
                  ),
              },
              true,
            )
          },
        })

        const root = document.createElement('div')
        createVaporApp(VaporForwardedSlot).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe(
          '<span>stable</span><i>inner</i><!--if--><!--slot-->',
        )

        useFallback.value = true
        await nextTick()
        expect(root.innerHTML).toBe(
          '<span>stable</span><i>inner</i><!--if--><!--slot-->',
        )

        showInner.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<span>stable</span><!--if--><!--slot-->')
      })

      test('vdom fallback toggles do not affect nested slots inside stable content', async () => {
        const useFallback = ref(false)
        const showInner = ref(false)

        const NestedSlotContainer = defineVaporComponent({
          setup() {
            return [template('<span>stable</span>')(), createSlot('bar', null)]
          },
        })

        const VdomSlotWithOptionalFallback = {
          render(this: any) {
            return renderSlot(
              this.$slots,
              'foo',
              {},
              useFallback.value
                ? () => [h('div', 'outer fallback')]
                : undefined,
            )
          },
        }

        const VaporForwardedSlot = defineVaporComponent({
          setup() {
            return createComponent(
              VdomSlotWithOptionalFallback,
              null,
              {
                foo: () =>
                  createComponent(
                    NestedSlotContainer,
                    null,
                    {
                      bar: () =>
                        createIf(
                          () => showInner.value,
                          () => template('<i>inner</i>')(),
                          undefined,
                          slotRootIfShape,
                        ),
                    },
                    true,
                  ),
              },
              true,
            )
          },
        })

        const root = document.createElement('div')
        createVaporApp(VaporForwardedSlot).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>stable</span><!--if--><!--slot-->')

        useFallback.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<span>stable</span><!--if--><!--slot-->')

        showInner.value = true
        await nextTick()
        expect(root.innerHTML).toBe(
          '<span>stable</span><i>inner</i><!--if--><!--slot-->',
        )

        showInner.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<span>stable</span><!--if--><!--slot-->')
      })

      test('vdom local fallback with stable content does not expose inherited fallback to nested slots', async () => {
        const VaporSlot = createVaporSlot('outer fallback')

        const NestedFallbackContainer = defineVaporComponent({
          setup() {
            return [
              template('<span>local stable</span>')(),
              createSlot('bar', null),
            ]
          },
        })

        const VdomForwardedSlotWithNestedFallback = {
          render(this: any) {
            return h(VaporSlot, null, {
              foo: () => [
                renderSlot(this.$slots, 'foo', {}, () => [
                  h(NestedFallbackContainer),
                ]),
              ],
              _: 3 /* FORWARDED */,
            })
          },
        }

        const App = createEmptyTestApp(VdomForwardedSlotWithNestedFallback)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>local stable</span>')
      })

      test('vdom local fallback does not expose inherited fallback to nested component slots', async () => {
        const VaporSlot = createVaporSlot('outer fallback')

        const NestedInteropContainer = defineVaporComponent({
          setup() {
            return createSlot('bar', null)
          },
        })
        const localFallback = vi.fn(() => [
          h(NestedInteropContainer, null, {
            baz: () => [h('span', 'unused')],
          }),
        ])

        const VdomForwardedSlotWithNestedInteropFallback = {
          render(this: any) {
            return h(VaporSlot, null, {
              foo: () => [renderSlot(this.$slots, 'foo', {}, localFallback)],
              _: 3 /* FORWARDED */,
            })
          },
        }

        const App = createEmptyTestApp(
          VdomForwardedSlotWithNestedInteropFallback,
        )

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(localFallback).toHaveBeenCalledTimes(1)
        expect(root.textContent).toBe('')
      })

      test('vdom local fallback rendering an empty vapor component stays content', async () => {
        const VaporSlot = createVaporSlot('outer fallback')

        const NestedVdomSlot = {
          render(this: any) {
            return renderSlot(this.$slots, 'bar')
          },
        }

        const NestedInteropForwardedSlot = defineVaporComponent({
          setup() {
            return createComponent(
              NestedVdomSlot,
              null,
              {
                bar: () => createForwardedSlotRoot('bar'),
              },
              true,
            )
          },
        })
        const localFallback = vi.fn(() => [h(NestedInteropForwardedSlot)])

        const VdomForwardedSlotWithNestedInteropFallback = {
          render(this: any) {
            return h(VaporSlot, null, {
              foo: () => [renderSlot(this.$slots, 'foo', {}, localFallback)],
              _: 3 /* FORWARDED */,
            })
          },
        }

        const App = createEmptyTestApp(
          VdomForwardedSlotWithNestedInteropFallback,
        )

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(localFallback).toHaveBeenCalledTimes(1)
        // an empty vapor component is content, as a vdom one is
        expect(root.textContent).toBe('')
      })

      test('vdom local fallback keeps nested component slots isolated from the outer fallback', async () => {
        const fallbackText = ref('outer fallback')

        const VaporSlot = defineVaporComponent({
          setup() {
            return createSlot('foo', null, () => {
              const el = template('<div></div>')()
              renderEffect(() => {
                setElementText(el, fallbackText.value)
              })
              return el
            })
          },
        })

        const NestedInteropContainer = defineVaporComponent({
          setup() {
            return createSlot('bar', null)
          },
        })

        const localFallback = vi.fn(() => [
          h(NestedInteropContainer, null, {
            baz: () => [h('span', 'unused')],
          }),
        ])

        const VdomForwardedSlotWithNestedInteropFallback = {
          render(this: any) {
            return h(VaporSlot, null, {
              foo: () => [renderSlot(this.$slots, 'foo', {}, localFallback)],
              _: 3 /* FORWARDED */,
            })
          },
        }

        const App = createEmptyTestApp(
          VdomForwardedSlotWithNestedInteropFallback,
        )

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(localFallback).toHaveBeenCalledTimes(1)
        expect(root.textContent).toBe('')

        fallbackText.value = 'updated outer fallback'
        await nextTick()

        expect(root.textContent).toBe('')
      })

      test('vdom forwarded inherited vapor fallback should clean up old fallback effects', async () => {
        const show = ref(false)
        const fallbackText = ref('fallback')
        const fallbackRuns = vi.fn()

        const VaporSlot = defineVaporComponent({
          setup() {
            return createSlot('foo', null, () => {
              const el = template('<div></div>')()
              renderEffect(() => {
                fallbackRuns()
                setElementText(el, fallbackText.value)
              })
              return el
            })
          },
        })

        const VdomForwardedSlot = {
          render(this: any) {
            return h(VaporSlot, null, {
              foo: () => [renderSlot(this.$slots, 'foo', {}, () => [])],
              _: 3 /* FORWARDED */,
            })
          },
        }

        const App = {
          setup() {
            return () =>
              h(
                VdomForwardedSlot,
                null,
                createSlots({ _: 2 /* DYNAMIC */ } as any, [
                  show.value
                    ? {
                        name: 'foo',
                        fn: () => [h('span', 'content')],
                        key: '0',
                      }
                    : undefined,
                ]),
              )
          },
        }

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<div>fallback</div>')

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<span>content</span>')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<div>fallback</div>')

        const runsBeforeUpdate = fallbackRuns.mock.calls.length
        fallbackText.value = 'updated'
        await nextTick()

        expect(root.innerHTML).toBe('<div>updated</div>')
        expect(fallbackRuns.mock.calls.length - runsBeforeUpdate).toBe(1)
      })

      test('unmounted passthrough vdom fallback should not react to inherited boundary updates', async () => {
        const showInner = ref(true)
        const useOuterFallback = ref(false)
        const localFallbackRuns = vi.fn()

        const InnerVdomSlot = {
          render(this: any) {
            return renderSlot(this.$slots, 'bar', {}, () => {
              localFallbackRuns()
              return [h('div', 'inner fallback')]
            })
          },
        }

        const OuterVdomSlot = {
          render(this: any) {
            return renderSlot(
              this.$slots,
              'foo',
              {},
              useOuterFallback.value
                ? () => [h('div', 'outer fallback')]
                : undefined,
            )
          },
        }

        const InnerBridge = defineVaporComponent({
          setup() {
            return createComponent(
              InnerVdomSlot,
              null,
              {
                bar: () => createForwardedSlotRoot('bar'),
              },
              true,
            )
          },
        })

        const OuterBridge = defineVaporComponent({
          setup() {
            return createComponent(
              OuterVdomSlot,
              null,
              {
                foo: () => createForwardedSlotRoot('foo'),
              },
              true,
            )
          },
        })

        const App = {
          setup() {
            return () =>
              h(
                OuterBridge,
                null,
                createSlots({ _: 2 /* DYNAMIC */ } as any, [
                  showInner.value
                    ? {
                        name: 'foo',
                        fn: () => [h(InnerBridge)],
                        key: '0',
                      }
                    : undefined,
                ]),
              )
          },
        }

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<div>inner fallback</div>')

        showInner.value = false
        await nextTick()
        expect(root.innerHTML).toBe('')

        const runsBefore = localFallbackRuns.mock.calls.length
        useOuterFallback.value = true
        await nextTick()
        useOuterFallback.value = false
        await nextTick()

        expect(localFallbackRuns.mock.calls.length).toBe(runsBefore)
      })

      test('mounted passthrough vdom local fallback ignores unrelated inherited boundary updates', async () => {
        const useOuterFallback = ref(false)
        const localFallbackRuns = vi.fn()

        const InnerVdomSlot = {
          render(this: any) {
            return renderSlot(this.$slots, 'bar', {}, () => {
              localFallbackRuns()
              return [h('div', 'inner fallback')]
            })
          },
        }

        const OuterVdomSlot = {
          render(this: any) {
            return renderSlot(
              this.$slots,
              'foo',
              {},
              useOuterFallback.value
                ? () => [h('div', 'outer fallback')]
                : undefined,
            )
          },
        }

        const InnerBridge = defineVaporComponent({
          setup() {
            return createComponent(
              InnerVdomSlot,
              null,
              {
                bar: () => createForwardedSlotRoot('bar'),
              },
              true,
            )
          },
        })

        const OuterBridge = defineVaporComponent({
          setup() {
            return createComponent(
              OuterVdomSlot,
              null,
              {
                foo: () => createForwardedSlotRoot('foo'),
              },
              true,
            )
          },
        })

        const App = {
          setup() {
            return () =>
              h(
                OuterBridge,
                null,
                createSlots({ _: 2 /* DYNAMIC */ } as any, [
                  {
                    name: 'foo',
                    fn: () => [h(InnerBridge)],
                    key: '0',
                  },
                ]),
              )
          },
        }

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<div>inner fallback</div>')

        const runsBefore = localFallbackRuns.mock.calls.length
        useOuterFallback.value = true
        await nextTick()

        expect(root.innerHTML).toBe('<div>inner fallback</div>')
        expect(localFallbackRuns.mock.calls.length - runsBefore).toBe(0)
      })

      test('failed forwarded vapor slot remount should not keep stale fallback watchers', async () => {
        const values = ref([0])
        const showFallback = ref(false)
        const fallbackRuns = vi.fn()
        const handled = vi.fn()

        const VdomChild = {
          render(this: any) {
            return renderSlot(
              this.$slots,
              'default',
              {},
              showFallback.value
                ? () => {
                    fallbackRuns()
                    return [h('div', 'outer fallback')]
                  }
                : undefined,
            )
          },
        }

        const VaporParent = defineVaporComponent({
          setup() {
            return createComponent(
              VdomChild,
              null,
              {
                $: [
                  createForSlots(
                    () => values.value,
                    value => () => {
                      if (value.value === 1) {
                        throw new Error('slot boom')
                      }
                      return template('<span>ok</span>')()
                    },
                    () => 'default',
                    value => value,
                  ),
                ],
              },
              true,
            )
          },
        })

        const root = document.createElement('div')
        const app = createApp({
          render: () => h(VaporParent as any),
        })
        app.use(vaporInteropPlugin)
        app.config.errorHandler = handled
        app.mount(root)

        expect(root.innerHTML).toBe('<span>ok</span>')

        values.value = [1]
        await nextTick()
        expect(handled).toHaveBeenCalledTimes(1)

        const runsBefore = fallbackRuns.mock.calls.length
        showFallback.value = true
        await nextTick()

        expect(fallbackRuns.mock.calls.length).toBe(runsBefore)
      })

      test('switching vdom fallback identity disposes stale fallback effects', async () => {
        const fallbackA = ref('fallback A')
        const fallbackB = ref('fallback B')
        const useFallbackA = ref(true)

        const VaporSlot = defineVaporComponent({
          setup() {
            return createSlot('foo', null) as any
          },
        })

        const VdomForwardedSlotWithDynamicFallback = {
          render(this: any) {
            return h(VaporSlot as any, null, {
              foo: () => [
                renderSlot(
                  this.$slots,
                  'foo',
                  {},
                  useFallbackA.value
                    ? () => [h('div', fallbackA.value)]
                    : () => [h('div', fallbackB.value)],
                ),
              ],
              _: 3 /* FORWARDED */,
            })
          },
        }

        const VaporForwardedSlot = createVaporForwardedSlot(
          VdomForwardedSlotWithDynamicFallback,
        )
        const App = createEmptyTestApp(VaporForwardedSlot)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<div>fallback A</div>')

        fallbackA.value = 'fallback A updated'
        await nextTick()
        expect(root.innerHTML).toBe('<div>fallback A updated</div>')

        useFallbackA.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<div>fallback B</div>')

        fallbackA.value = 'stale fallback A'
        await nextTick()
        expect(root.innerHTML).toBe('<div>fallback B</div>')

        fallbackB.value = 'fallback B updated'
        await nextTick()
        expect(root.innerHTML).toBe('<div>fallback B updated</div>')
      })

      test('vdom slot does not evaluate fallback while forwarded vapor content resolves valid output', () => {
        const fallback = vi.fn(() => [h('div', 'fallback')])

        const VdomSlot = {
          render(this: any) {
            return renderSlot(this.$slots, 'foo', {}, fallback)
          },
        }

        const VaporForwardedSlot = defineVaporComponent({
          setup() {
            return createComponent(
              VdomSlot,
              null,
              {
                foo: () =>
                  createIf(
                    () => true,
                    () => template('<span>content</span>')(),
                  ),
              },
              true,
            )
          },
        })

        const App = createEmptyTestApp(VaporForwardedSlot)
        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)

        expect(root.textContent).toBe('content')
        expect(fallback).not.toHaveBeenCalled()
      })

      test('vdom slot > vapor forwarded slot > vdom forwarded slot > vdom slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VdomSlot = createVdomSlot()
        const VdomForwardedSlot = createVdomForwardedSlot(VdomSlot)
        const VaporForwardedSlot = createVaporForwardedSlot(VdomForwardedSlot)
        const App = createTestApp(VaporForwardedSlot, foo, show)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span>')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span>')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<div>fallback</div>')

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span>')
      })

      test('vdom slot > vapor forwarded slot(with fallback) > vdom forwarded slot > vdom slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VdomSlot = createVdomSlot()
        const VdomForwardedSlot = createVdomForwardedSlot(VdomSlot)
        const VaporForwardedSlotWithFallback = createVaporForwardedSlot(
          VdomForwardedSlot,
          'vapor fallback',
        )
        const App = createTestApp(VaporForwardedSlotWithFallback, foo, show)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span>')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span>')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<div>vapor fallback</div>')

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span>')
      })

      test('vdom slot > vapor forwarded slot > vdom forwarded slot(with fallback) > vdom slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VdomSlot = createVdomSlot()

        const VdomForwardedSlotWithFallback = createVdomForwardedSlot(
          VdomSlot,
          'vdom fallback',
        )
        const VaporForwardedSlot = createVaporForwardedSlot(
          VdomForwardedSlotWithFallback,
        )
        const App = createTestApp(VaporForwardedSlot, foo, show)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span>')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span>')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<div>vdom fallback</div>')

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span>')
      })

      test('vdom slot > vapor forwarded slot (multiple) > vdom forwarded slot > vdom slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VdomSlot = createVdomSlot()
        const VdomForwardedSlot = createVdomForwardedSlot(VdomSlot)
        const VaporForwardedSlot = createMultipleVaporForwardedSlots(
          VdomForwardedSlot,
          3,
        )
        const App = createTestApp(VaporForwardedSlot, foo, show)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span><!--slot--><!--slot-->')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot--><!--slot-->')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<!--slot--><!--slot--><div>fallback</div>')

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot--><!--slot-->')
      })

      test('vdom slot > vapor forwarded slot (multiple) > vdom forwarded slot(with fallback) > vdom slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VdomSlot = createVdomSlot()
        const VdomForwardedSlotWithFallback = createVdomForwardedSlot(
          VdomSlot,
          'vdom fallback',
        )
        const VaporForwardedSlot = createMultipleVaporForwardedSlots(
          VdomForwardedSlotWithFallback,
          3,
        )
        const App = createTestApp(VaporForwardedSlot, foo, show)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span><!--slot--><!--slot-->')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot--><!--slot-->')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe(
          '<!--slot--><!--slot--><div>vdom fallback</div>',
        )

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot--><!--slot-->')
      })

      test('vdom slot > vdom forwarded slot > vapor slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VaporSlot = createVaporSlot()
        const VdomForwardedSlot = createVdomForwardedSlot(VaporSlot)
        const App = createTestApp(VdomForwardedSlot, foo, show)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span>')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span>')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<div>fallback</div>')

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span>')
      })

      test('vdom slot > vdom forwarded slot > vapor forwarded slot > vapor slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VaporSlot = createVaporSlot()
        const VaporForwardedSlot = createVaporForwardedSlot(VaporSlot)
        const VdomForwardedSlot = createVdomForwardedSlot(VaporForwardedSlot)
        const App = createTestApp(VdomForwardedSlot, foo, show)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span><!--slot-->')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot-->')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<div>fallback</div><!--slot-->')

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot-->')
      })

      test('vdom slot > vdom forwarded slot (multiple) > vapor forwarded slot > vdom slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VaporSlot = createVaporSlot()
        const VaporForwardedSlot = createVaporForwardedSlot(VaporSlot)
        const VdomForwardedSlot = createMultipleVdomForwardedSlots(
          VaporForwardedSlot,
          3,
        )
        const App = createTestApp(VdomForwardedSlot, foo, show)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span><!--slot-->')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot-->')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<div>fallback</div><!--slot-->')

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot-->')
      })

      test('vdom slot > vdom forwarded slot (multiple) > vapor forwarded slot(with fallback) > vdom slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VaporSlot = createVaporSlot()
        const VaporForwardedSlot = createVaporForwardedSlot(
          VaporSlot,
          'vapor fallback',
        )
        const VdomForwardedSlot = createMultipleVdomForwardedSlots(
          VaporForwardedSlot,
          3,
        )
        const App = createTestApp(VdomForwardedSlot, foo, show)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span><!--slot-->')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot-->')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<div>vapor fallback</div><!--slot-->')

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot-->')
      })

      test('vdom slot > vapor forwarded slot > vapor forwarded slot > vdom slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VdomSlot = createVdomSlot()
        const VaporForwardedSlot1 = createMultipleVaporForwardedSlots(
          VdomSlot,
          2,
        )
        const App = createTestApp(VaporForwardedSlot1, foo, show)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span><!--slot-->')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot-->')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<!--slot--><div>fallback</div>')

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot-->')
      })

      test('vdom slot > vapor forwarded slot(with fallback) > vapor forwarded slot > vdom slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VdomSlot = createVdomSlot()
        const VaporForwardedSlot2 = createVaporForwardedSlot(VdomSlot)
        const VaporForwardedSlot1WithFallback = createVaporForwardedSlot(
          VaporForwardedSlot2,
          'vapor1 fallback',
        )
        const App = createTestApp(VaporForwardedSlot1WithFallback, foo, show)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span><!--slot-->')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot-->')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<div>vapor1 fallback</div><!--slot-->')

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot-->')
      })

      test('vdom slot > vapor forwarded slot > vapor forwarded slot(with fallback) > vdom slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VdomSlot = createVdomSlot()
        const VaporForwardedSlot2WithFallback = createVaporForwardedSlot(
          VdomSlot,
          'vapor2 fallback',
        )
        const VaporForwardedSlot1 = createVaporForwardedSlot(
          VaporForwardedSlot2WithFallback,
        )
        const App = createTestApp(VaporForwardedSlot1, foo, show)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span><!--slot-->')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot-->')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<div>vapor2 fallback</div><!--slot-->')

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot-->')
      })

      test('vdom slot > vapor forwarded slot > vapor forwarded slot > vapor slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VaporSlot = createVaporSlot()
        const VaporForwardedSlot2 = createVaporForwardedSlot(VaporSlot)
        const VaporForwardedSlot1 =
          createVaporForwardedSlot(VaporForwardedSlot2)
        const App = createTestApp(VaporForwardedSlot1, foo, show)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span><!--slot--><!--slot-->')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot--><!--slot-->')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<!--slot--><div>fallback</div><!--slot-->')

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot--><!--slot-->')
      })

      test('vdom slot > vapor forwarded slot(with fallback) > vapor forwarded slot(with fallback) > vdom slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VdomSlot = createVdomSlot()
        const VaporForwardedSlot2WithFallback = createVaporForwardedSlot(
          VdomSlot,
          'vapor2 fallback',
        )
        const VaporForwardedSlot1WithFallback = createVaporForwardedSlot(
          VaporForwardedSlot2WithFallback,
          'vapor1 fallback',
        )
        const App = createTestApp(VaporForwardedSlot1WithFallback, foo, show)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span><!--slot-->')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot-->')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<div>vapor1 fallback</div><!--slot-->')

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot-->')
      })

      test('vdom slot > vapor forwarded slot(with fallback) > vapor forwarded slot(with fallback) > vapor slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VaporSlot = createVaporSlot()
        const VaporForwardedSlot2WithFallback = createVaporForwardedSlot(
          VaporSlot,
          'vapor2 fallback',
        )
        const VaporForwardedSlot1WithFallback = createVaporForwardedSlot(
          VaporForwardedSlot2WithFallback,
          'vapor1 fallback',
        )
        const App = createTestApp(VaporForwardedSlot1WithFallback, foo, show)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span><!--slot--><!--slot-->')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot--><!--slot-->')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe(
          '<div>vapor1 fallback</div><!--slot--><!--slot-->',
        )

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot--><!--slot-->')
      })

      test('vdom slot > vdom forwarded slot(with fallback) > vdom forwarded slot(with fallback) > vapor slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VaporSlot = createVaporSlot()
        const VdomForwardedSlot2WithFallback = createVdomForwardedSlot(
          VaporSlot,
          'vdom2 fallback',
        )
        const VdomForwardedSlot1WithFallback = createVdomForwardedSlot(
          VdomForwardedSlot2WithFallback,
          'vdom1 fallback',
        )
        const App = createTestApp(VdomForwardedSlot1WithFallback, foo, show)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span>')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span>')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<div>vdom1 fallback</div>')

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span>')
      })

      test('vdom slot > vdom forwarded slot(with fallback) > vdom forwarded slot(with fallback) > vdom slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VdomSlot = createVdomSlot()
        const VdomForwardedSlot2WithFallback = createVdomForwardedSlot(
          VdomSlot,
          'vdom2 fallback',
        )
        const VdomForwardedSlot1WithFallback = createVdomForwardedSlot(
          VdomForwardedSlot2WithFallback,
          'vdom1 fallback',
        )
        const App = createTestApp(VdomForwardedSlot1WithFallback, foo, show)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span>')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span>')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<div>vdom1 fallback</div>')

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span>')
      })

      test('vdom slot > vdom forwarded slot(with fallback) > vdom forwarded slot(with fallback) (multiple) > vapor slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VaporSlot = createVaporSlot()
        const VdomForwardedSlot3WithFallback = createVdomForwardedSlot(
          VaporSlot,
          'vdom3 fallback',
        )
        const VdomForwardedSlot2WithFallback = createVdomForwardedSlot(
          VdomForwardedSlot3WithFallback,
          'vdom2 fallback',
        )
        const VdomForwardedSlot1WithFallback = createVdomForwardedSlot(
          VdomForwardedSlot2WithFallback,
          'vdom1 fallback',
        )
        const App = createTestApp(VdomForwardedSlot1WithFallback, foo, show)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span>')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span>')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<div>vdom1 fallback</div>')

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span>')
      })
    })
  })

  describe('createForSlots', () => {
    test('should work', async () => {
      const loop = ref([1, 2, 3])

      let instance: any
      const Child = () => {
        instance = currentInstance
        return template('child')()
      }

      const { render } = define({
        setup() {
          return createComponent(Child, null, {
            $: [
              createForSlots(
                () => loop.value,
                (item, i) => () => template(item.value + i!.value)(),
                item => item,
              ),
            ],
          })
        },
      })
      render()

      expect(instance.slots).toHaveProperty('1')
      expect(instance.slots).toHaveProperty('2')
      expect(instance.slots).toHaveProperty('3')
      loop.value.push(4)
      await nextTick()
      expect(instance.slots).toHaveProperty('4')
      loop.value.shift()
      await nextTick()
      expect(instance.slots).not.toHaveProperty('1')
    })

    test('should preserve result identity when slot resolution is unchanged', () => {
      const items = ref([
        { id: 1, name: 'a', label: 'A0' },
        { id: 2, name: 'b', label: 'B0' },
      ])
      let renderedItem: any
      const source = createForSlots(
        () => items.value,
        item => () => {
          renderedItem = item.value
          return template('content')()
        },
        item => item.name,
        item => item.id,
      )

      const first = source()
      const firstSlot = first[0]
      items.value = [
        { id: 1, name: 'a', label: 'A1' },
        { id: 2, name: 'b', label: 'B1' },
      ]
      const second = source()

      expect(second).toBe(first)
      expect(second[0]).toBe(firstSlot)
      second[0].fn()
      expect(renderedItem).toBe(items.value[0])

      items.value.reverse()
      const reordered = source()
      expect(reordered).not.toBe(second)

      items.value[0].name = 'c'
      expect(source()).not.toBe(reordered)
    })

    test('should cache dynamic slot source result', async () => {
      const items = ref([1, 2, 3])
      let callCount = 0

      const getItems = () => {
        callCount++
        return items.value
      }

      let instance: any
      const Child = defineVaporComponent(() => {
        instance = currentInstance
        // Create multiple slots to trigger multiple getSlot calls
        const n1 = template('<div></div>')()
        const n2 = template('<div></div>')()
        const n3 = template('<div></div>')()
        insert(createSlot('slot1'), n1 as any as ParentNode)
        insert(createSlot('slot2'), n2 as any as ParentNode)
        insert(createSlot('slot3'), n3 as any as ParentNode)
        return [n1, n2, n3]
      })

      define({
        setup() {
          return createComponent(Child, null, {
            $: [
              createForSlots(
                getItems,
                item => () => template(String(item.value))(),
                item => 'slot' + item,
              ),
            ],
          })
        },
      }).render()

      // getItems should only be called once
      expect(callCount).toBe(1)

      expect(instance.slots).toHaveProperty('slot1')
      expect(instance.slots).toHaveProperty('slot2')
      expect(instance.slots).toHaveProperty('slot3')
    })

    test('should update when source changes', async () => {
      const items = ref([1, 2])
      let callCount = 0

      const getItems = () => {
        callCount++
        return items.value
      }

      let instance: any
      const Child = defineVaporComponent(() => {
        instance = currentInstance
        const n1 = template('<div></div>')()
        const n2 = template('<div></div>')()
        const n3 = template('<div></div>')()
        insert(createSlot('slot1'), n1 as any as ParentNode)
        insert(createSlot('slot2'), n2 as any as ParentNode)
        insert(createSlot('slot3'), n3 as any as ParentNode)
        return [n1, n2, n3]
      })

      define({
        setup() {
          return createComponent(Child, null, {
            $: [
              createForSlots(
                getItems,
                item => () => template(String(item.value))(),
                item => 'slot' + item,
              ),
            ],
          })
        },
      }).render()

      expect(callCount).toBe(1)
      expect(instance.slots).toHaveProperty('slot1')
      expect(instance.slots).toHaveProperty('slot2')
      expect(instance.slots).not.toHaveProperty('slot3')

      // Update items
      items.value.push(3)
      await nextTick()

      // Should be called again after source changes
      expect(callCount).toBe(2)
      expect(instance.slots).toHaveProperty('slot1')
      expect(instance.slots).toHaveProperty('slot2')
      expect(instance.slots).toHaveProperty('slot3')
    })

    test('should render slots correctly with caching', async () => {
      const items = ref([1, 2, 3, 4, 5])

      const Child = defineVaporComponent(() => {
        const containers: any[] = []
        for (let i = 1; i <= 5; i++) {
          const n = template('<div></div>')()
          insert(createSlot('slot' + i), n as any as ParentNode)
          containers.push(n)
        }
        return containers
      })

      const { host } = define({
        setup() {
          return createComponent(Child, null, {
            $: [
              createForSlots(
                () => items.value,
                item => () => template('content' + item.value)(),
                item => 'slot' + item,
              ),
            ],
          })
        },
      }).render()

      expect(host.innerHTML).toBe(
        '<div>content1<!--slot--></div>' +
          '<div>content2<!--slot--></div>' +
          '<div>content3<!--slot--></div>' +
          '<div>content4<!--slot--></div>' +
          '<div>content5<!--slot--></div>',
      )

      // Update items
      items.value = [2, 4]
      await nextTick()

      expect(host.innerHTML).toBe(
        '<div><!--slot--></div>' +
          '<div>content2<!--slot--></div>' +
          '<div><!--slot--></div>' +
          '<div>content4<!--slot--></div>' +
          '<div><!--slot--></div>',
      )
    })

    // #14648
    test('should use last slot when v-for generates duplicate slot names', async () => {
      const list = ref([0, 1, 2])

      const Child = defineVaporComponent(() => {
        const n = template('<div></div>')()
        insert(createSlot('default'), n as any as ParentNode)
        return n
      })

      const { host } = define({
        setup() {
          return createComponent(Child, null, {
            $: [
              createForSlots(
                () => list.value,
                item => () => {
                  const n = template(' ')() as Text
                  renderEffect(() => setText(n, String(item.value)))
                  return n
                },
                () => 'default',
              ),
            ],
          })
        },
      }).render()

      // should display the last item (last wins, matching vDOM behavior)
      expect(host.innerHTML).toBe('<div>2<!--slot--></div>')

      // push: new last item should be displayed
      list.value.push(3)
      await nextTick()
      expect(host.innerHTML).toBe('<div>3<!--slot--></div>')

      // pop: should fall back to previous last item
      list.value.pop()
      await nextTick()
      expect(host.innerHTML).toBe('<div>2<!--slot--></div>')

      // splice middle: last item unchanged
      list.value.splice(1, 1)
      await nextTick()
      expect(host.innerHTML).toBe('<div>2<!--slot--></div>')
    })

    test('should work with null and undefined', async () => {
      const loop = ref<number[] | null | undefined>(undefined)

      let instance: any
      const Child = () => {
        instance = currentInstance
        return template('child')()
      }

      const { render } = define({
        setup() {
          return createComponent(Child, null, {
            $: [
              createForSlots(
                () => loop.value as any,
                (item, i) => () => template(item.value + i!.value)(),
                item => item,
              ),
            ],
          })
        },
      })
      render()

      expect(instance.slots).toEqual({})
      loop.value = [1]
      await nextTick()
      expect(instance.slots).toHaveProperty('1')
      loop.value = null
      await nextTick()
      expect(instance.slots).toEqual({})
    })

    // #15276
    test('should preserve keyed slot records across source updates', async () => {
      const state = ref({
        showA: false,
        items: [
          { id: 'a1', name: 'a', label: 'A0' },
          { id: 'b1', name: 'b', label: 'B0' },
        ],
      })
      const unmounted = vi.fn()
      const Content = compile(
        `<script setup vapor>
        import { onUnmounted, ref } from 'vue'
        const props = defineProps(['label'])
        const count = ref(0)
        onUnmounted(_components.unmounted)
        </script>
        <template>
          <button @click="count++">{{ props.label }}:{{ count }}</button>
        </template>`,
        state,
        { unmounted },
      )
      const Child = compile(
        `<template>
          <div id="b"><slot name="b" /></div>
          <div v-if="data.showA" id="a"><slot name="a" /></div>
        </template>`,
        state,
      )
      const App = compile(
        `<template>
          <components.Child>
            <template
              v-for="item in data.items"
              :key="item.id"
              #[item.name]
            >
              <components.Content :label="item.label" />
            </template>
          </components.Child>
        </template>`,
        state,
        { Child, Content },
      )
      const root = document.createElement('div')
      const app = createVaporApp(App)

      try {
        app.mount(root)
        state.value.items = [
          { id: 'a1', name: 'a', label: 'A1' },
          { id: 'b1', name: 'b', label: 'B1' },
        ]
        await nextTick()

        state.value.showA = true
        await nextTick()
        const firstButton = root.querySelector<HTMLButtonElement>('#a button')!
        expect(firstButton.textContent).toBe('A1:0')
        firstButton.click()
        firstButton.click()
        await nextTick()

        state.value.items = [
          { id: 'a1', name: 'a', label: 'A2' },
          { id: 'b1', name: 'b', label: 'B2' },
        ]
        await nextTick()

        expect(root.querySelector('#a button')).toBe(firstButton)
        expect(firstButton.textContent).toBe('A2:2')
        expect(root.querySelector('#b')!.textContent).toBe('B2:0')
        expect(unmounted).not.toHaveBeenCalled()

        state.value.items = [
          { id: 'a2', name: 'a', label: 'A3' },
          { id: 'b1', name: 'b', label: 'B3' },
        ]
        await nextTick()

        expect(root.querySelector('#a button')).not.toBe(firstButton)
        expect(root.querySelector('#a')!.textContent).toBe('A3:0')
        expect(unmounted).toHaveBeenCalledOnce()
      } finally {
        app.unmount()
      }
    })

    test('should preserve unkeyed slot content by name when reordered', async () => {
      const items = ref([
        { name: 'a', label: 'A0' },
        { name: 'b', label: 'B0' },
      ])
      const Content = compile(
        `<script setup vapor>
        import { ref } from 'vue'
        const props = defineProps(['label'])
        const count = ref(0)
        </script>
        <template>
          <button @click="count++">{{ props.label }}:{{ count }}</button>
        </template>`,
        items,
      )
      const Child = compile(
        `<template><slot name="a" /><slot name="b" /></template>`,
        items,
      )
      const App = compile(
        `<template>
          <components.Child>
            <template v-for="item in data" #[item.name]>
              <components.Content :label="item.label" />
            </template>
          </components.Child>
        </template>`,
        items,
        { Child, Content },
      )
      const root = document.createElement('div')
      const app = createVaporApp(App)

      try {
        app.mount(root)
        const [buttonA, buttonB] = root.querySelectorAll('button')
        buttonA.click()
        buttonB.click()
        buttonB.click()
        await nextTick()

        items.value = [
          { name: 'b', label: 'B1' },
          { name: 'a', label: 'A1' },
        ]
        await nextTick()

        const buttons = root.querySelectorAll('button')
        expect(buttons[0]).toBe(buttonA)
        expect(buttons[0].textContent).toBe('A1:1')
        expect(buttons[1]).toBe(buttonB)
        expect(buttons[1].textContent).toBe('B1:2')
      } finally {
        app.unmount()
      }
    })

    test('should remove teleported content when a dynamic v-for slot is removed', async () => {
      const cats = ref(['a', 'b'])
      const unmounted = vi.fn()
      const Modal = compile(
        `<script setup vapor>
        import { onUnmounted } from 'vue'
        onUnmounted(_components.unmounted)
        </script>
        <template>
          <Teleport to="body">
            <div id="teleported">teleported</div>
          </Teleport>
        </template>`,
        cats,
        { unmounted },
      )
      const Host = compile(
        `<template>
          <div v-for="c in data" :key="c">
            <slot :name="c" />
          </div>
        </template>`,
        cats,
      )
      const App = compile(
        `<template>
          <components.Host>
            <template v-for="c in data" :key="c" #[c]>
              <components.Modal v-if="c === 'a'" />
            </template>
          </components.Host>
        </template>`,
        cats,
        { Host, Modal },
      )
      const root = document.createElement('div')
      const app = createVaporApp(App)

      try {
        app.mount(root)
        expect(document.body.querySelectorAll('#teleported')).toHaveLength(1)

        cats.value = ['b']
        await nextTick()

        expect(unmounted).toHaveBeenCalledOnce()
        expect(document.body.querySelectorAll('#teleported')).toHaveLength(0)
      } finally {
        app.unmount()
        document.querySelectorAll('#teleported').forEach(node => node.remove())
      }
    })

    test('should leave disabled teleport content to its main-view owner', async () => {
      const cats = ref(['a', 'b'])
      let leaveDone: (() => void) | undefined
      const onLeave = vi.fn((_el: Element, done: () => void) => {
        leaveDone = done
      })
      const target = document.createElement('div')
      const Modal = compile(
        `<template>
          <Teleport :to="components.target" disabled>
            <span>teleported</span>
          </Teleport>
        </template>`,
        cats,
        { target },
      )
      const Host = compile(
        `<template>
          <TransitionGroup :css="false" @leave="components.onLeave">
            <div v-for="c in data" :key="c">
              <slot :name="c" />
            </div>
          </TransitionGroup>
        </template>`,
        cats,
        { onLeave },
      )
      const App = compile(
        `<template>
          <components.Host>
            <template v-for="c in data" :key="c" #[c]>
              <components.Modal v-if="c === 'a'" />
            </template>
          </components.Host>
        </template>`,
        cats,
        { Host, Modal },
      )
      const root = document.createElement('div')
      const app = createVaporApp(App)

      try {
        app.mount(root)
        cats.value = ['b']
        await nextTick()

        expect(onLeave).toHaveBeenCalledOnce()
        expect(root.textContent).toContain('teleported')

        leaveDone!()
        await nextTick()

        expect(root.textContent).not.toContain('teleported')
      } finally {
        leaveDone?.()
        app.unmount()
      }
    })
  })

  describe('stable dynamic slot functions', () => {
    describe.each([true, false])('vapor child: %s', vapor => {
      test.each(['v-if="data.list.length" #default', '#[data.names[0]]'])(
        'preserves state and updates slot props when %s recomputes',
        async declaration => {
          const data = ref({
            list: [1],
            names: ['default'],
            text: 'a',
            value: 1,
          })
          const Content = compile(
            `<script setup vapor>
              import { ref } from 'vue'
              const props = defineProps(['label'])
              const count = ref(0)
            </script>
            <template><button @click="count++">{{ props.label }}:{{ count }}</button></template>`,
            data,
          )
          const Child = compile(
            `<script setup>const data = _data</script>
            <template><slot :value="data.value" /></template>`,
            data,
            {},
            { vapor },
          )
          const App = compile(
            `<template>
              <components.Child>
                <template ${declaration}="{ value }">
                  <input :data-label="data.text + ':' + value" />
                  <components.Content :label="data.text + ':' + value" />
                </template>
              </components.Child>
            </template>`,
            data,
            { Child, Content },
          )
          const root = document.createElement('div')
          document.body.appendChild(root)
          const app = createVaporApp(App).use(vaporInteropPlugin)
          try {
            app.mount(root)
            const input = root.querySelector('input')!
            const button = root.querySelector('button')!
            button.click()
            input.value = 'typed'
            input.focus()
            await nextTick()
            expect(button.textContent).toBe('a:1:1')

            data.value.list.push(2)
            data.value.names = ['default']
            data.value.text = 'b'
            data.value.value = 2
            await nextTick()

            expect(root.querySelector('input')).toBe(input)
            expect(document.activeElement).toBe(input)
            expect(input.value).toBe('typed')
            expect(input.dataset.label).toBe('b:2')
            expect(root.querySelector('button')!.textContent).toBe('b:2:1')

            data.value.value = 3
            await nextTick()
            expect(input.dataset.label).toBe('b:3')
            expect(root.querySelector('button')!.textContent).toBe('b:3:1')
          } finally {
            app.unmount()
            root.remove()
          }
        },
      )
    })

    test('replaces content only when switching conditional branches', async () => {
      const data = ref(1)
      const Child = compile(`<template><slot /></template>`, data)
      const App = compile(
        `<template>
          <components.Child>
            <template v-if="data < 10" #default><input id="a" /></template>
            <template v-else-if="data < 20" #default><input id="b" /></template>
            <template v-else #default><input id="c" /></template>
          </components.Child>
        </template>`,
        data,
        { Child },
      )
      const root = document.createElement('div')
      const app = createVaporApp(App)
      try {
        app.mount(root)
        let input = root.querySelector('input')!
        for (const value of [2, 15, 16, 25, 26, 1]) {
          data.value = value
          await nextTick()
          const next = root.querySelector('input')!
          const id = value < 10 ? 'a' : value < 20 ? 'b' : 'c'
          expect(next.id).toBe(id)
          expect(next === input).toBe(input.id === id)
          input = next
        }
      } finally {
        app.unmount()
      }
    })

    test('swaps content when dynamic slot declarations exchange names', async () => {
      await renderParity(
        {
          Child: `<template><slot name="a" /></template>`,
          App: `<template>
            <components.Child>
              <template #[data[0]]><input id="first" /></template>
              <template #[data[1]]><input id="second" /></template>
            </components.Child>
          </template>`,
        },
        () => ref(['a', 'b']),
        async (data, root) => {
          expect(root.querySelector('input')!.id).toBe('first')
          data.value = ['b', 'a']
          await nextTick()
          expect(root.querySelector('input')!.id).toBe('second')
        },
      )
    })

    test('replaces content when the dynamic slot and outlet are renamed together', async () => {
      await renderParity(
        {
          Child: `<template><slot :name="data" /></template>`,
          App: `<template>
            <components.Child><template #[data]><input /></template></components.Child>
          </template>`,
        },
        () => ref('p'),
        async (data, root) => {
          const input = root.querySelector('input')!
          input.value = 'typed'
          data.value = 'q'
          await nextTick()
          expect(root.querySelector('input')).not.toBe(input)
          expect(root.querySelector('input')!.value).toBe('')
        },
      )
    })

    test('keeps functions inside the outer v-for scope', async () => {
      const data = ref([
        { id: 'a', label: 'A', list: [1] },
        { id: 'b', label: 'B', list: [1] },
      ])
      const Child = compile(`<template><slot /></template>`, data)
      const App = compile(
        `<template>
          <components.Child v-for="row in data" :key="row.id">
            <template v-if="row.list.length" #default>
              <input :data-label="row.label" />
            </template>
          </components.Child>
        </template>`,
        data,
        { Child },
      )
      const root = document.createElement('div')
      const app = createVaporApp(App)
      try {
        app.mount(root)
        const [a, b] = root.querySelectorAll('input')
        data.value = [
          { id: 'b', label: 'B2', list: [1, 2] },
          { id: 'a', label: 'A2', list: [1, 2] },
        ]
        await nextTick()
        const inputs = root.querySelectorAll('input')
        expect(inputs[0]).toBe(b)
        expect(inputs[1]).toBe(a)
        expect(a.dataset.label).toBe('A2')
        expect(b.dataset.label).toBe('B2')
      } finally {
        app.unmount()
      }
    })

    test('captures nested slot props without shadowing the outer slot binding', async () => {
      const data = ref({ list: [1], label: 'A' })
      const Outer = compile(`<template><slot :row="data" /></template>`, data)
      const Child = compile(
        `<template><slot :value="data.label" /></template>`,
        data,
      )
      const App = compile(
        `<template>
          <components.Outer v-slot="s">
            <components.Child>
              <template v-if="s.row.list.length" #default="inner">
                <input :data-label="s.row.label + ':' + inner.value" />
              </template>
            </components.Child>
          </components.Outer>
        </template>`,
        data,
        { Child, Outer },
      )
      const root = document.createElement('div')
      const app = createVaporApp(App)
      try {
        app.mount(root)
        const input = root.querySelector('input')!
        expect(input.dataset.label).toBe('A:A')
        data.value = { list: [1, 2], label: 'B' }
        await nextTick()
        expect(root.querySelector('input')).toBe(input)
        expect(input.dataset.label).toBe('B:B')
      } finally {
        app.unmount()
      }
    })
  })

  // A dynamic slot descriptor is the parent's expression as much as a prop
  // getter is: the child reads what the parent delivered, in its update order.
  describe('dynamic slot descriptors are delivered', () => {
    const Child = (read: string) => `<script setup>
      import { useSlots, watchSyncEffect } from 'vue'
      const data = _data
      const slots = useSlots()
      watchSyncEffect(() => data.value.seen.push(${read}))
    </script><template><div><slot name="foo" /></div></template>`

    async function expectGuarded(
      srcs: Record<string, string>,
      x: any,
      first: unknown,
    ) {
      const seen: Record<string, unknown[]> = {}
      const { vdom, vapor } = await renderParity(
        srcs,
        () => ref<any>({ x, seen: [] }),
        (data, root, mode) => {
          data.value.x = undefined
          seen[mode] = [...data.value.seen]
        },
      )
      expect(seen.vdom).toEqual([first])
      expect(seen.vapor).toEqual(seen.vdom)
      expect(vapor.text).toBe('gone')
      expect(vdom.text).toBe(vapor.text)
    }

    test('conditional slot read by a sync watcher', () =>
      expectGuarded(
        {
          Child: Child('!!slots.foo'),
          App: `<template>
            <components.Child v-if="data.x !== undefined">
              <template #foo v-if="data.x.show">foo</template>
            </components.Child>
            <p v-else>gone</p>
          </template>`,
        },
        { show: true },
        true,
      ))

    test('dynamic slot name read by a sync watcher', () =>
      expectGuarded(
        {
          Child: Child('Object.keys(slots).join()'),
          App: `<template>
            <components.Child v-if="data.x !== undefined">
              <template #[data.x.name]>foo</template>
            </components.Child>
            <p v-else>gone</p>
          </template>`,
        },
        { name: 'foo' },
        'foo',
      ))

    test('v-for slots read by a sync watcher', () =>
      expectGuarded(
        {
          Child: Child('Object.keys(slots).join()'),
          App: `<template>
            <components.Child v-if="data.x !== undefined">
              <template v-for="name in data.x.names" #[name]>{{ name }}</template>
            </components.Child>
            <p v-else>gone</p>
          </template>`,
        },
        { names: ['foo', 'bar'] },
        'foo,bar',
      ))

    test('vdom child under a vapor parent', async () => {
      const data = ref<any>({ x: { show: true }, seen: [] })
      const components: Record<string, any> = {}
      components.Child = compile(Child('!!slots.foo'), data, components, {
        vapor: false,
      })
      const App = compile(
        `<template>
          <components.Child v-if="data.x !== undefined">
            <template #foo v-if="data.x.show">foo</template>
          </components.Child>
          <p v-else>gone</p>
        </template>`,
        data,
        components,
        { vapor: true },
      )
      const root = document.createElement('div')
      const app = createVaporApp(App)
      app.use(vaporInteropPlugin).mount(root)
      expect(root.textContent).toBe('foo')
      data.value.x = undefined
      expect(data.value.seen).toEqual([true])
      await nextTick()
      expect(root.textContent).toBe('gone')
      app.unmount()
    })

    // vdom slots are not reactive, so only the timing is comparable: nothing
    // reaches the child before the parent's update
    test('a slot toggle reaches the child in the flush', async () => {
      const seen: Record<string, unknown[]> = {}
      const { vdom, vapor } = await renderParity(
        {
          Child: Child('!!slots.foo'),
          App: `<template>
            <components.Child>
              <template #foo v-if="data.x.show">foo</template>
            </components.Child>
          </template>`,
        },
        () => ref<any>({ x: { show: true }, seen: [] }),
        async (data, root, mode) => {
          data.value.x.show = false
          seen[mode] = [...data.value.seen]
          await nextTick()
        },
      )
      expect(seen.vdom).toEqual([true])
      expect(seen.vapor).toEqual(seen.vdom)
      expect(vapor.text).toBe('')
      expect(vdom.text).toBe(vapor.text)
    })

    test('descriptors run after the vdom host that guards them', async () => {
      const data = ref<any>({ x: { flag: true } })
      const components: Record<string, any> = {}
      components.Host = compile(
        `<script setup>
          defineProps({ show: Boolean })
        </script><template><div v-if="show"><slot /></div></template>`,
        data,
        components,
        { vapor: false },
      )
      components.Child = compile(
        `<template><b><slot name="foo" /></b></template>`,
        data,
        components,
      )
      const App = compile(
        `<template>
          <components.Host :show="data.x !== undefined">
            <components.Child>
              <template #foo v-if="data.x.flag">F</template>
            </components.Child>
          </components.Host>
        </template>`,
        data,
        components,
      )
      const root = document.createElement('div')
      const app = createVaporApp(App)
      app.use(vaporInteropPlugin).mount(root)
      expect(root.textContent).toBe('F')
      data.value.x = undefined
      await nextTick()
      expect(root.textContent).toBe('')
      app.unmount()
    })

    // the inner component's props arrive one hop later than the wrapper's
    test('an async inner component reads its props before the descriptors', async () => {
      let resolve!: (comp: any) => void
      const data = ref<any>({ item: undefined, seen: [] })
      const components: Record<string, any> = {}
      components.Inner = compile(
        `<script setup>
          import { useSlots, watchSyncEffect } from 'vue'
          const data = _data
          const props = defineProps({ item: Object })
          const slots = useSlots()
          watchSyncEffect(() => {
            const item = props.item
            if (slots.foo) data.value.seen.push(item.name)
          })
        </script><template><div><slot name="foo" /></div></template>`,
        data,
        components,
      )
      components.Async = defineVaporAsyncComponent(
        () => new Promise(r => (resolve = r)),
      )
      const App = compile(
        `<template>
          <components.Async :item="data.item">
            <template v-if="data.item" #foo>foo</template>
          </components.Async>
        </template>`,
        data,
        components,
      )
      const root = document.createElement('div')
      const app = createVaporApp(App)
      app.mount(root)
      resolve(components.Inner)
      await new Promise(r => setTimeout(r))
      expect(root.innerHTML).toBe(
        '<div><!--slot--></div><!--async component-->',
      )
      data.value.item = { name: 'n' }
      await nextTick()
      expect(data.value.seen).toEqual(['n'])
      expect(root.textContent).toBe('foo')
      app.unmount()
    })

    // a cache hit rebinds the props to the call site; the descriptors keep
    // following them
    test('descriptors follow the props again after a KeepAlive cache hit', async () => {
      const data = ref<any>({ cur: 'A', item: undefined, seen: [] })
      const components: Record<string, any> = {}
      const KeptChild = (name: string) =>
        compile(
          `<script setup>
            import { useSlots, watchSyncEffect } from 'vue'
            const data = _data
            const props = defineProps({ item: Object })
            const slots = useSlots()
            watchSyncEffect(() => {
              const item = props.item
              if (slots.foo) data.value.seen.push('${name}:' + item.name)
            })
          </script><template><div><slot name="foo" /></div></template>`,
          data,
          components,
        )
      components.A = KeptChild('A')
      components.B = KeptChild('B')
      const App = compile(
        `<script setup vapor>
          const data = _data
          const components = _components
        </script><template>
          <KeepAlive>
            <component :is="components[data.cur]" :item="data.item">
              <template v-if="data.item" #foo>foo</template>
            </component>
          </KeepAlive>
        </template>`,
        data,
        components,
      )
      const root = document.createElement('div')
      const app = createVaporApp(App)
      app.mount(root)
      data.value.cur = 'B'
      await nextTick()
      data.value.cur = 'A'
      await nextTick()
      data.value.item = { name: 'n' }
      await nextTick()
      expect(data.value.seen).toEqual(['A:n'])
      expect(root.textContent).toBe('foo')
      app.unmount()
    })

    // props and descriptors reach a sync watcher together. vdom delivers the
    // props first, so the watcher throws there
    test.each([
      ['vapor', true],
      ['vdom', false],
    ])(
      'a delivery is atomic across props and descriptors for a %s child',
      async (_, vapor) => {
        const data = ref<any>({ x: { item: { name: 'a' } }, seen: [] })
        const components: Record<string, any> = {}
        components.Child = compile(
          `<script setup>
            import { useSlots, watchSyncEffect } from 'vue'
            const data = _data
            const props = defineProps({ item: Object })
            const slots = useSlots()
            watchSyncEffect(() => {
              if (slots.foo) data.value.seen.push(props.item.name)
            })
          </script><template><div><slot name="foo" /></div></template>`,
          data,
          components,
          { vapor },
        )
        const App = compile(
          `<template>
            <components.Child :item="data.x && data.x.item">
              <template v-if="data.x" #foo>foo</template>
            </components.Child>
          </template>`,
          data,
          components,
        )
        const root = document.createElement('div')
        const app = createVaporApp(App)
        app.use(vaporInteropPlugin).mount(root)
        expect(data.value.seen).toEqual(['a'])
        data.value.x = null
        await nextTick()
        expect(data.value.seen).toEqual(['a'])
        expect(root.textContent).toBe('')
        data.value.x = { item: { name: 'b' } }
        await nextTick()
        expect(data.value.seen).toEqual(['a', 'b'])
        app.unmount()
      },
    )

    test('a vdom parent delivers props and slots to a vapor child together', async () => {
      const data = ref<any>({ x: { item: { name: 'a' } }, seen: [] })
      const components: Record<string, any> = {}
      components.Child = compile(
        `<script setup>
          import { useSlots, watchSyncEffect } from 'vue'
          const data = _data
          const props = defineProps({ item: Object })
          const slots = useSlots()
          watchSyncEffect(() => {
            if (slots.foo) data.value.seen.push(props.item.name)
          })
        </script><template><div><slot name="foo" /></div></template>`,
        data,
        components,
      )
      const App = compile(
        `<script setup>const data = _data; const components = _components;</script>
        <template>
          <components.Child :item="data.x && data.x.item">
            <template v-if="data.x" #foo>foo</template>
          </components.Child>
        </template>`,
        data,
        components,
        { vapor: false },
      )
      const root = document.createElement('div')
      const app = createApp(App)
      app.use(vaporInteropPlugin).mount(root)
      expect(data.value.seen).toEqual(['a'])
      data.value.x = null
      await nextTick()
      expect(data.value.seen).toEqual(['a'])
      data.value.x = { item: { name: 'b' } }
      await nextTick()
      expect(data.value.seen).toEqual(['a', 'b'])
      app.unmount()
    })

    // the delivery runs inside the vdom parent's update: a throwing sync
    // watcher must not leave the tracking context unrestored
    test('a throwing sync watcher in a vapor child of a vdom parent', async () => {
      const data = ref<any>({ n: 0 })
      const components: Record<string, any> = {}
      components.Child = compile(
        `<script setup>
          import { watch } from 'vue'
          const props = defineProps({ n: Number })
          watch(
            () => props.n,
            () => {
              throw new Error('boom')
            },
            { flush: 'sync' },
          )
        </script><template><i>{{ n }}</i></template>`,
        data,
        components,
      )
      const App = compile(
        `<script setup>const data = _data; const components = _components;</script>
        <template><components.Child :n="data.n" /></template>`,
        data,
        components,
        { vapor: false },
      )
      const root = document.createElement('div')
      const app = createApp(App)
      app.use(vaporInteropPlugin).mount(root)
      data.value.n = 1
      await expect(nextTick()).rejects.toThrow('boom')
      expect(
        'Unhandled error during execution of watcher callback',
      ).toHaveBeenWarned()
      expect(
        'Unhandled error during execution of component update',
      ).toHaveBeenWarned()
      app.unmount()
    })

    // props are evaluated before the descriptors, as in vdom: one read, and
    // none after the creation was aborted
    test.each([
      ['vapor', true],
      ['vdom', false],
    ])(
      'a throwing descriptor leaves no input of a %s child behind',
      async (_, vapor) => {
        const data = ref<any>({ n: 0, counter: markRaw({ reads: 0 }) })
        const components: Record<string, any> = {}
        components.Child = compile(
          `<script setup>
            defineProps({ n: Number })
          </script><template><div><slot name="foo" /></div></template>`,
          data,
          components,
          { vapor },
        )
        const App = compile(
          `<script setup>
            const data = _data
            const components = _components
            const read = () => (data.value.counter.reads++, data.value.n)
          </script><template>
            <components.Child :n="read()">
              <template #[data.slot.name]>foo</template>
            </components.Child>
          </template>`,
          data,
          components,
          { vapor: true },
        )
        const app = createVaporApp(App)
        app.use(vaporInteropPlugin)
        expect(() => app.mount(document.createElement('div'))).toThrow()
        expect(
          'Unhandled error during execution of setup function',
        ).toHaveBeenWarned()
        expect(data.value.counter.reads).toBe(1)
        data.value.n++
        await nextTick()
        expect(data.value.counter.reads).toBe(1)
      },
    )
  })
})

describe('slot-scope component tags', () => {
  test.each([
    '<components.Provider v-slot="{ Foo }"><Foo /></components.Provider>',
    '<components.Provider v-slot="slotProps"><slot-props.Foo /></components.Provider>',
    '<components.Provider v-slot="{ parts }"><parts.Foo /></components.Provider>',
    '<components.Provider v-slot="{ Foo }"><Foo /><components.Other v-slot="{ Foo }"><Foo /></components.Other><Foo /></components.Provider>',
  ])('renders components from slot props: %s', async template => {
    const result = await renderParity(
      {
        Leaf: '<template><b>leaf</b></template>',
        Nested: '<template><i>nested</i></template>',
        Provider:
          '<template><slot :Foo="components.Leaf" :parts="{ Foo: components.Leaf }" /></template>',
        Other: '<template><slot :Foo="components.Nested" /></template>',
        App: `<template>${template}</template>`,
      },
      () => ref(null),
      () => {},
    )
    expect(result.vapor.text).toBe(result.vdom.text)
    expect(result.vapor.text).toBe(
      template.includes('Other') ? 'leafnestedleaf' : 'leaf',
    )
  })
})

describe('whitespace between conditional slots', () => {
  test.each([
    ['condense', 'v-else'],
    ['preserve', 'v-else'],
    ['condense', 'v-else-if="!data.ok"'],
    ['preserve', 'v-else-if="!data.ok"'],
  ] as const)(
    'preserves implicit default slot whitespace with whitespace: %s and %s',
    async (whitespace, branch) => {
      const { vdom, vapor } = await renderParity(
        {
          Comp: '<template><p><slot /></p></template>',
          App: `<template><components.Comp><b>A</b><template #named v-if="data.ok">X</template> <template #named ${branch}>Y</template><i>B</i></components.Comp></template>`,
        },
        () => ref({ ok: false }),
        (data, root) => {
          expect(root.textContent).toBe('A B')
          data.value.ok = true
        },
        {},
        { whitespace },
      )
      expect(vapor.text).toBe('A B')
      expect(vapor.text).toBe(vdom.text)
    },
  )
})

test('slots object supports hasOwnProperty like vdom', async () => {
  const { vdom, vapor } = await renderParity(
    {
      Comp: `<script setup>
        import { useSlots } from 'vue'
        const slots = useSlots()
      </script>
      <template><p>{{ slots.hasOwnProperty('header') }}<b v-if="$slots.hasOwnProperty('footer')"><slot name="footer" /></b><i v-if="$slots.hasOwnProperty('extra')">extra</i></p></template>`,
      App: `<template><components.Comp><template #header>H</template><template #footer v-if="data.ok">F</template></components.Comp></template>`,
    },
    () => ref({ ok: true }),
    async (data, root) => {
      expect(root.textContent).toBe('trueF')
      data.value.ok = false
    },
  )
  expect(vdom.text).toBe('true')
  expect(vapor.text).toBe(vdom.text)
})

test('caches native dynamic slot descriptors across reads', async () => {
  const data = ref({ name: 'default' })
  const read = vi.fn(() => data.value.name)
  const Child = compile(
    `<script setup vapor>const read = _components.read</script>
     <template><component :is="'div'"><template #[read()]><span>content</span></template></component></template>`,
    data,
    { read },
  )
  const App = compile('<template><components.Child /></template>', data, {
    Child,
  })
  const root = document.createElement('div')
  const app = createVaporApp(App)
  try {
    app.mount(root)
    expect(root.textContent).toBe('content')
    expect(read).toHaveBeenCalledTimes(1)
    data.value.name = 'other'
    await nextTick()
    expect(root.textContent).toBe('')
    expect(read).toHaveBeenCalledTimes(2)
    data.value.name = 'default'
    await nextTick()
    expect(root.textContent).toBe('content')
    expect(read).toHaveBeenCalledTimes(3)
  } finally {
    app.unmount()
  }
})

test.each(['id="a"', 'v-bind="data"'])(
  'scoped slot props support hasOwnProperty like vdom (%s)',
  async binding => {
    const { vdom, vapor } = await renderParity(
      {
        Comp: `<template><slot ${binding} /></template>`,
        App: `<template><components.Comp v-slot="props"><p>{{ props.hasOwnProperty('id') }}-{{ props.hasOwnProperty('missing') }}-{{ props.hasOwnProperty('toString') }}-{{ Object.keys(props).join(',') }}</p></components.Comp></template>`,
      },
      () => ref({ id: 'a' }),
      () => {},
    )
    expect(vdom.text).toBe('true-false-false-id')
    expect(vapor.text).toBe(vdom.text)
  },
)

test('scoped slot props with an undefined value shadow Object.prototype', async () => {
  const { vdom, vapor } = await renderParity(
    {
      Comp: `<template><slot v-bind="data" /></template>`,
      App: `<template><components.Comp v-slot="props"><p>{{ props.toString === undefined }}-{{ props.toString === Object.prototype.toString }}</p></components.Comp></template>`,
    },
    () => ref<any>({ toString: undefined }),
    (data, root) => {
      expect(root.textContent).toBe('true-false')
      data.value = {}
    },
  )
  expect(vdom.text).toBe('false-true')
  expect(vapor.text).toBe(vdom.text)
})

test.each([
  ['{ b: { c } = { c: 1 } }', '{{ c }}', { b: {} }, ''],
  ['{ b: { c } = { c: 1 } }', '{{ c }}', {}, '1'],
  ['{ b: [x, y] = [1, 2] }', '{{ x }}-{{ y }}', { b: [] }, '-'],
])(
  'scoped slot destructure defaults apply at their own level like vdom: %s',
  async (pattern, body, init, expected) => {
    const { vdom, vapor } = await renderParity(
      {
        Child: `<template><slot v-bind="data" /></template>`,
        App: `<template><components.Child v-slot="${pattern}">${body}</components.Child></template>`,
      },
      () => ref<any>(init),
      () => {},
    )
    expect(vdom.text).toBe(expected)
    expect(vapor.text).toBe(vdom.text)
  },
)

describe('fallback is owned by the providing outlet', () => {
  // `tick()` runs once per live copy of the outer fallback body each time
  // it renders, so its count tells how many outlets materialized it.
  function mount(outerFallback: string, localFallback: string, levels = 2) {
    let ticks = 0
    const data = ref({ x: false, y: false, tick: () => (ticks++, '') })
    const Outer = compile(
      `<template>
        <slot>${outerFallback}</slot>
      </template>`,
      data,
    )
    let Parent = compile(
      `<template>
        <components.Outer><slot>${localFallback}</slot></components.Outer>
      </template>`,
      data,
      { Outer },
    )
    if (levels === 3) {
      Parent = compile(
        `<template>
          <components.Mid><slot /></components.Mid>
        </template>`,
        data,
        { Mid: Parent },
      )
    }
    const App = compile(
      `<template>
        <components.Parent>
          <span v-if="false">content</span>
        </components.Parent>
      </template>`,
      data,
      { Parent },
    )
    const root = document.createElement('div')
    const app = createVaporApp(App)
    app.mount(root)
    return { data, root, app, ticks: () => ticks }
  }

  const dynamicOuter = `<span v-if="data.x">{{ data.tick() }}outer</span>`
  const dynamicLocal = `<i v-if="data.y">local</i>`

  test('renders an outer fallback once per chain, not once per outlet', async () => {
    const t = mount(dynamicOuter, '')
    expect(t.ticks()).toBe(0)

    t.data.value.x = true
    await nextTick()
    expect(t.root.textContent).toBe('outer')
    expect(t.ticks()).toBe(1)

    t.data.value.x = false
    await nextTick()
    expect(t.root.textContent).toBe('')

    t.data.value.x = true
    await nextTick()
    expect(t.root.textContent).toBe('outer')
    expect(t.ticks()).toBe(2)
    t.app.unmount()
  })

  test('renders an outer fallback once behind three forwarded levels', async () => {
    const t = mount(dynamicOuter, '', 3)

    t.data.value.x = true
    await nextTick()
    expect(t.root.textContent).toBe('outer')
    expect(t.ticks()).toBe(1)
    t.app.unmount()
  })

  test('local fallback wins when it becomes valid after the outer one', async () => {
    const t = mount(dynamicOuter, dynamicLocal)

    t.data.value.x = true
    await nextTick()
    expect(t.root.textContent).toBe('outer')

    t.data.value.y = true
    await nextTick()
    expect(t.root.textContent).toBe('local')

    t.data.value.y = false
    await nextTick()
    expect(t.root.textContent).toBe('outer')
    t.app.unmount()
  })

  // coverage guard
  test('local fallback keeps winning when it becomes valid before the outer one', async () => {
    const t = mount(dynamicOuter, dynamicLocal)

    t.data.value.y = true
    await nextTick()
    expect(t.root.textContent).toBe('local')

    t.data.value.x = true
    await nextTick()
    expect(t.root.textContent).toBe('local')

    t.data.value.y = false
    await nextTick()
    expect(t.root.textContent).toBe('outer')

    t.data.value.y = true
    await nextTick()
    expect(t.root.textContent).toBe('local')
    t.app.unmount()
  })

  // the text after every step, vapor against vdom
  async function textAfterSteps(
    srcs: Record<string, string>,
    init: Record<string, boolean>,
    steps: Record<string, boolean>[],
  ): Promise<string[]> {
    const texts: Record<string, string[]> = { vdom: [], vapor: [] }
    await renderParity(
      srcs,
      () => ref({ ...init }),
      async (data, root, mode) => {
        texts[mode].push(root.textContent!)
        for (const step of steps) {
          Object.assign(data.value, step)
          await nextTick()
          texts[mode].push(root.textContent!)
        }
      },
    )
    expect(texts.vapor).toEqual(texts.vdom)
    return texts.vdom
  }

  // a forwarded outlet as the body of a local fallback, with the outer
  // outlet providing a fallback of its own
  const nestedFallbackOutlet = {
    Outer: `<template>
      <div><slot><b v-if="data.o">ofb</b></slot></div>
    </template>`,
    Mid: `<template>
      <components.Outer>
        <slot><slot name="x"><i v-if="data.m">mfb</i></slot></slot>
      </components.Outer>
    </template>`,
    App: `<template>
      <components.Mid><span v-if="data.c">c</span></components.Mid>
    </template>`,
  }

  test('a forwarded outlet inside a local fallback becomes valid', async () => {
    const texts = await textAfterSteps(
      nestedFallbackOutlet,
      { c: false, m: false, o: false },
      [{ m: true }, { m: false }, { m: true }],
    )
    expect(texts).toEqual(['', 'mfb', '', 'mfb'])
  })
})

describe('invalid content stays in the DOM', () => {
  test('a fallback committed while invalid shows once it becomes valid, like vdom', async () => {
    const texts: Record<string, string[]> = { vdom: [], vapor: [] }
    await renderParity(
      {
        Outer: `
          <template>
            <slot><b v-if="data.z">fb</b></slot>
          </template>`,
        App: `
          <template>
            <components.Outer><span v-if="data.x">c</span></components.Outer>
          </template>`,
      },
      () => ref({ x: false, z: false }),
      async (data, root, mode) => {
        const log = () => texts[mode].push(root.textContent!)
        log()
        data.value.x = true
        await nextTick()
        log()
        data.value.x = false
        await nextTick()
        log()
        data.value.z = true
        await nextTick()
        log()
        data.value.z = false
        await nextTick()
        log()
      },
    )
    expect(texts.vdom).toEqual(['', 'c', '', 'fb', ''])
    expect(texts.vapor).toEqual(texts.vdom)
  })

  test('a forwarded fallback root under a Transition renders in place', async () => {
    const data = ref({ x: false, z: false })
    const Outer = compile(
      `<template>
        <Transition><slot /></Transition>
      </template>`,
      data,
    )
    const Mid = compile(
      `<template>
        <components.Outer><slot><b v-if="data.z">fb</b></slot></components.Outer>
      </template>`,
      data,
      { Outer },
    )
    const App = compile(
      `<template>
        <components.Mid><span v-if="data.x">c</span></components.Mid>
      </template>`,
      data,
      { Mid },
    )
    const root = document.createElement('div')
    const app = createVaporApp(App)
    app.mount(root)
    expect(root.textContent).toBe('')

    data.value.z = true
    await nextTick()
    expect(root.textContent).toBe('fb')
    app.unmount()
  })

  test('a row inserted before a dynamic-name outlet showing its fallback', async () => {
    const data = ref({ rows: [1], name: 'a', show: false })
    const Child = compile(
      `<script setup vapor>
      const data = _data
      const props = defineProps(['row'])
      </script>
      <template>
        <slot :name="data.name"><p>{{ props.row }}</p></slot>
      </template>`,
      data,
    )
    const App = compile(
      `<template>
        <template v-for="row in data.rows" :key="row">
          <components.Child :row="row">
            <template #a><span v-if="data.show">a</span></template>
            <template #b><span v-if="data.show">b</span></template>
          </components.Child>
        </template>
      </template>`,
      data,
      { Child },
    )
    const root = document.createElement('div')
    const app = createVaporApp(App)
    app.mount(root)
    expect(root.textContent).toBe('1')

    // the content re-renders behind the fallback
    data.value.name = 'b'
    await nextTick()
    expect(root.textContent).toBe('1')

    data.value.rows = [2, 1]
    await nextTick()
    expect(root.textContent).toBe('21')
    app.unmount()
  })

  test('a Teleport-rooted fallback renders while the content is invalid, like vdom', async () => {
    const target = document.createElement('div')
    target.id = 'invalid-content-fallback-target'
    document.body.appendChild(target)
    const texts: Record<string, string[]> = { vdom: [], vapor: [] }
    try {
      await renderParity(
        {
          Outer: `
            <template>
              <slot>
                <Teleport to="#invalid-content-fallback-target"><b>fb</b></Teleport>
              </slot>
            </template>`,
          App: `
            <template>
              <components.Outer><span v-if="data.x">c</span></components.Outer>
            </template>`,
        },
        () => ref({ x: false }),
        async (data, root, mode) => {
          const log = () =>
            texts[mode].push(root.textContent + '|' + target.textContent)
          log()
          data.value.x = true
          await nextTick()
          log()
          data.value.x = false
          await nextTick()
          log()
        },
      )
    } finally {
      target.remove()
    }
    expect(texts.vdom).toEqual(['|fb', 'c|', '|fb'])
    expect(texts.vapor).toEqual(texts.vdom)
  })
})

describe('content and fallback sequenced under a Transition', () => {
  // Transition mode on the providing outlet sequences the leaving content
  // against the fallback the way vdom sequences a child swap: the hooks
  // and the DOM after every step must match for every slot-root shape.
  // `done` releases the oldest pending leave.
  const transitionLog = async (
    srcs: Record<string, string>,
    steps: ('on' | 'off' | 'done' | ((data: any) => void))[],
    {
      init = {},
      settledOnly = false,
      selector = 'div,i',
    }: {
      init?: Record<string, any>
      settledOnly?: boolean
      selector?: string
    } = {},
  ) => {
    const logs: Record<string, string[]> = {}
    const dom = (root: HTMLElement) =>
      Array.from(root.querySelectorAll(selector))
        .map(
          el =>
            (el.className || el.tagName) +
            ((el as HTMLElement).style.display === 'none' ? '(hidden)' : ''),
        )
        .join(',')
    await renderParity(
      srcs,
      () => {
        const data: any = ref({
          show: true,
          ...init,
          dones: [] as (() => void)[],
          onEnter: (el: Element) =>
            data.value.log.push('enter:' + el.className),
          onLeave: (el: Element, done: () => void) => {
            data.value.log.push('leave:' + el.className)
            data.value.dones.push(done)
          },
        })
        return data
      },
      async (data, root, mode) => {
        const log: string[] = (data.value.log = logs[mode] = [])
        for (const step of steps) {
          if (step === 'done') {
            const done = data.value.dones.shift()
            if (done) done()
          } else if (isString(step)) {
            data.value.show = step === 'on'
          } else {
            step(data.value)
          }
          await nextTick()
          log.push((isString(step) ? step : 'set') + ' ' + dom(root))
        }
        if (settledOnly) log.splice(0, log.length - 1)
      },
    )
    expect(logs.vapor).toEqual(logs.vdom)
  }
  const transitionOutlet = (
    mode: string,
    fallback = '<div class="fallback">fb</div>',
  ) => `
    <template>
      <Transition
        ${mode ? `mode="${mode}"` : ''}
        :css="false"
        @before-enter="data.onEnter"
        @leave="data.onLeave"
      >
        <slot>${fallback}</slot>
      </Transition>
    </template>`
  const contentApp = (outer: string) => `
    <template>
      <components.${outer}>
        <div v-if="data.show" class="content">c</div>
      </components.${outer}>
    </template>`
  const forwardingMiddle = `
    <template>
      <components.Outer><slot /></components.Outer>
    </template>`
  const transitionShapes = (
    mode: string,
    fallback?: string,
  ): Record<string, Record<string, string>> => ({
    'slot-root v-if': {
      Outer: transitionOutlet(mode, fallback),
      App: contentApp('Outer'),
    },
    'forwarded slot-root v-if': {
      Outer: transitionOutlet(mode, fallback),
      Middle: contentApp('Outer'),
      App: `<template><components.Middle /></template>`,
    },
    'forwarded outlet with a conditional slot': {
      Outer: transitionOutlet(mode, fallback),
      Middle: forwardingMiddle,
      App: `
        <template>
          <components.Middle>
            <template v-if="data.show" #default>
              <div class="content">c</div>
            </template>
          </components.Middle>
        </template>`,
    },
    'forwarded outlet whose content v-if flips': {
      Outer: transitionOutlet(mode, fallback),
      Middle: forwardingMiddle,
      App: contentApp('Middle'),
    },
  })

  describe.each(['out-in', 'in-out'])('%s swap, like vdom', mode => {
    test.each(Object.entries(transitionShapes(mode)))('%s', (_, srcs) =>
      transitionLog(srcs, ['off', 'done', 'on', 'done']),
    )

    // Toggles racing a leave: the content keeps rendering while the
    // fallback leaves, and the branch exposed once the leave ends follows
    // the data rather than the leave that happened to be running.
    test.each(Object.entries(transitionShapes(mode)))(
      '%s, toggled during a leave',
      async (_, srcs) => {
        await transitionLog(
          srcs,
          ['off', 'done', 'on', 'off', 'done', 'done', 'done'],
          { settledOnly: true },
        )
        await transitionLog(srcs, ['off', 'on', 'done', 'done', 'done'], {
          settledOnly: true,
        })
        await transitionLog(srcs, ['on', 'off', 'on', 'done', 'done', 'done'], {
          init: { show: false },
          settledOnly: true,
        })
      },
    )

    // A fallback rendering no element at the swap is no transition child:
    // the content leaves on its own, and the element the fallback renders
    // meanwhile enters at once, as it does after vdom's comment child.
    describe('fallback growing an element while the content leaves', () => {
      // a conditional slot leaving as a whole is still paired, unlike vdom's
      // comment child (T37)
      const shapes = Object.entries(
        transitionShapes(
          mode,
          '<div v-if="data.ready" class="fallback">fb</div>',
        ),
      ).filter(([name]) => name !== 'forwarded outlet with a conditional slot')
      describe.each(shapes)('%s', (_, srcs) => {
        const scripts: [string, Parameters<typeof transitionLog>[1]][] = [
          [
            'growing it after the swap',
            ['off', d => (d.ready = true), 'done', 'on', 'done'],
          ],
          [
            'with the element at the swap',
            [
              d => {
                d.show = false
                d.ready = true
              },
              'done',
              'on',
              'done',
            ],
          ],
          [
            'the content back meanwhile',
            ['off', d => (d.ready = true), 'on', 'done', 'done'],
          ],
          // back before the fallback grew anything: the root that left
          // finishes on its own, the next one enters at once
          [
            'the content back during its own leave',
            ['off', 'on', 'done', 'done'],
          ],
          [
            'the content toggled off, on and off during its leave',
            ['off', 'on', 'off', 'done', 'done', 'on', 'done', 'done'],
          ],
        ]
        test.each(scripts)('%s', (_, steps) =>
          transitionLog(srcs, steps, { init: { ready: false } }),
        )
      })

      // a component is a child to animate however empty its root, as to vdom
      test('a fallback component whose root renders later', () =>
        transitionLog(
          {
            Fb: `
              <template>
                <div v-if="data.ready" class="fallback">fb</div>
              </template>`,
            Outer: transitionOutlet(mode, '<components.Fb />'),
            App: contentApp('Outer'),
          },
          ['off', d => (d.ready = true), 'done', 'done'],
          { init: { ready: false } },
        ))

      // nested outlets whose fallbacks grow an element at once: the nearer
      // one shows, the root still leaving is placed by its anchor only
      test('nested fallbacks growing an element together', () =>
        transitionLog(
          {
            Outer: transitionOutlet(
              mode,
              '<div v-if="data.far" class="far">far</div>',
            ),
            Middle: `
              <template>
                <components.Outer>
                  <slot><div v-if="data.near" class="near">near</div></slot>
                </components.Outer>
              </template>`,
            App: contentApp('Middle'),
          },
          [
            'off',
            d => {
              d.far = true
              d.near = true
            },
            'done',
            'done',
          ],
          { init: { far: false, near: false } },
        ))

      // the swap is paired once the fallback has a child: the Transition's
      // other branches wait on the leave as they would under vdom, also
      // once the content came back meanwhile
      const switchingOutlet = `
        <template>
          <Transition
            mode="${mode}"
            :css="false"
            @before-enter="data.onEnter"
            @leave="data.onLeave"
          >
            <slot v-if="data.outlet"><div class="fallback">fb</div></slot>
            <i v-else class="alt">alt</i>
          </Transition>
        </template>`
      const switches: [string, Parameters<typeof transitionLog>[1]][] = [
        [
          'while the fallback waits',
          ['off', d => (d.outlet = false), 'done', 'done'],
        ],
        [
          'after the content returned during the leave',
          ['off', 'on', d => (d.outlet = false), 'done', 'done'],
        ],
      ]
      test.each(switches)('an enclosing branch switched %s', (_, steps) =>
        transitionLog(
          { Outer: switchingOutlet, App: contentApp('Outer') },
          steps,
          { init: { outlet: true } },
        ),
      )
    })

    // A fallback-body root leaving empty has no incoming branch: it leaves
    // right away, like a vdom child swapping to a comment.
    test('fallback-body slot root leaving empty', () =>
      transitionLog(
        {
          Outer: transitionOutlet(
            mode,
            '<div v-if="data.show" class="fallback">fb</div>',
          ),
          App: `
            <template>
              <components.Outer>
                <div v-if="data.c" class="content">c</div>
              </components.Outer>
            </template>`,
        },
        ['off', 'done', 'on', 'done'],
        { init: { c: false } },
      ))

    test('fallback-body slot root swapping to its v-else', () =>
      transitionLog(
        {
          Outer: transitionOutlet(
            mode,
            '<div v-if="data.show" class="fallback">fb</div><div v-else class="other">o</div>',
          ),
          App: `
            <template>
              <components.Outer>
                <div v-if="data.c" class="content">c</div>
              </components.Outer>
            </template>`,
        },
        ['off', 'done', 'on', 'done'],
        { init: { c: false } },
      ))

    // The leave of content handed to the next entering block goes to the
    // fallback that actually enters, past a nearer provider whose fallback
    // is invalid; the root that left is found through that outlet also when
    // a comment makes the content an array.
    test.each([
      ['', '<slot><i v-if="data.y">mf</i></slot>'],
      [
        ' beside a comment',
        `<!-- keep -->
                <slot><i v-if="data.y" class="mf">mf</i></slot>`,
      ],
    ])('content leaving past an invalid nearer fallback%s', (_, body) =>
      transitionLog(
        {
          Outer: transitionOutlet(mode),
          Middle: `
            <template>
              <components.Outer>
                ${body}
              </components.Outer>
            </template>`,
          App: contentApp('Middle'),
        },
        ['off', 'done', 'on', 'done'],
        { init: { y: false } },
      ),
    )

    // the root that left is found below a structural wrapper around a
    // forwarding outlet exposing its own empty fallback
    test.each([
      ['v-if', 'v-if="data.wrap"'],
      ['v-for', 'v-for="i in data.items" :key="i"'],
    ])(
      'content leaving below a template %s around a forwarding outlet',
      (_, dir) =>
        transitionLog(
          {
            Outer: transitionOutlet(mode),
            Middle: `
            <template>
              <components.Outer>
                <template ${dir}>
                  <slot><i v-if="data.y" class="mf">mf</i></slot>
                </template>
              </components.Outer>
            </template>`,
            App: contentApp('Middle'),
          },
          ['off', 'done', 'on', 'done'],
          { init: { y: false, wrap: true, items: [1] } },
        ),
    )
  })

  describe.each(['out-in', 'in-out', ''])('mode "%s"', mode => {
    // A fallback shown from the mount is exposed before Transition applies
    // its hooks. The content replacing it still enters, and the fallback
    // still leaves as its own branch (vdom keys it `_fb`).
    test('content arriving after a mount-time fallback', () =>
      transitionLog(
        { Outer: transitionOutlet(mode), App: contentApp('Outer') },
        ['on', 'done', 'off', 'done', 'on', 'done'],
        { init: { show: false } },
      ))

    test('content arriving after a mount-time keyed fallback', () =>
      transitionLog(
        {
          Outer: transitionOutlet(
            mode,
            '<div key="k" class="fallback">fb</div>',
          ),
          App: contentApp('Outer'),
        },
        ['on', 'done', 'off', 'done'],
        { init: { show: false } },
      ))

    // A v-show fallback root makes the hooks persisted (vapor derives it
    // at runtime, vdom never does through a slot): the swap is not
    // sequenced, since a persisted leave never reports its end.
    test('v-show fallback root', async () => {
      const data = ref({ show: false, vis: true, onLeave: NOOP })
      const Outer = compile(
        transitionOutlet(
          mode,
          '<div v-show="data.vis" class="fallback">fb</div>',
        ),
        data,
      )
      const App = compile(contentApp('Outer'), data, { Outer })
      const root = document.createElement('div')
      const app = createVaporApp(App)
      app.mount(root)
      expect(root.textContent).toBe('fb')
      for (let i = 0; i < 2; i++) {
        data.value.show = true
        await nextTick()
        expect(root.textContent).toBe('c')
        data.value.show = false
        await nextTick()
        expect(root.textContent).toBe('fb')
      }
      app.unmount()
    })

    // A held root still removes its previous branch from the DOM: only the
    // next branch renders detached.
    test('a held root replaces its previous invalid branch', async () => {
      const dones: (() => void)[] = []
      const data = ref({
        show: true,
        onEnter: NOOP,
        onLeave: (_el: Element, done: () => void) => {
          dones.push(done)
        },
      })
      const Outer = compile(
        transitionOutlet(mode, '<div class="fb">fb</div>'),
        data,
      )
      const App = compile(
        `<template>
          <div class="root">
            <components.Outer>
              <div v-if="data.show" class="content">c</div>
              <template v-else><!--keep--></template>
            </components.Outer>
          </div>
        </template>`,
        data,
        { Outer },
      )
      const root = document.createElement('div')
      const app = createVaporApp(App)
      app.mount(root)
      const settle = async () => {
        for (let i = 0; i < 3; i++) {
          dones.splice(0).forEach(done => done())
          await nextTick()
        }
      }
      const initial = root.innerHTML
      for (let i = 0; i < 3; i++) {
        data.value.show = false
        await nextTick()
        await settle()
        data.value.show = true
        await nextTick()
        await settle()
        expect(root.innerHTML).toBe(initial)
      }
      // the comment branch is no child for Transition (vdom skips it)
      expect(
        'Transition component has no valid child element',
      ).toHaveBeenWarned()
      app.unmount()
    })

    // Coverage guard: a fallback root keyed like the content root is still a
    // branch of its own (vdom composes the key under `_fb`).
    test('content and fallback sharing an explicit key', () =>
      transitionLog(
        {
          Outer: transitionOutlet(
            mode,
            '<div key="k" class="fallback">fb</div>',
          ),
          App: `
            <template>
              <components.Outer>
                <div v-if="data.show" key="k" class="content">c</div>
              </components.Outer>
            </template>`,
        },
        ['off', 'done', 'on', 'done'],
      ))
  })

  // The fallback of an outlet nested in a fallback body is keyed under the
  // enclosing fallback's key, `_<name>_fb` composed as vdom composes them: a
  // re-rendered one early-removes the previous one still leaving.
  test('a nested outlet fallback re-rendered while the previous one leaves replaces it', () =>
    transitionLog(
      {
        Outer: transitionOutlet(
          '',
          '<slot name="other"><div class="fallback">fb</div></slot>',
        ),
        App: contentApp('Outer'),
      },
      ['off', 'on', 'off', 'done', 'done', 'done'],
    ))

  const keepAliveApp = `
    <template>
      <div class="root">
        <KeepAlive>
          <components.A v-if="data.which === 'a'" />
          <components.B v-else />
        </KeepAlive>
      </div>
    </template>`

  // The out-in window belongs to the outlet: tearing the outlet down while
  // its fallback leaves must neither throw nor land the content afterwards.
  const outInOutlet = transitionOutlet('out-in', '<div class="fb">fb</div>')
  test('out-in: the outlet unmounts while its fallback leaves', async () => {
    const dones: (() => void)[] = []
    const data = ref({
      show: false,
      alive: true,
      onEnter: NOOP,
      onLeave: (_el: Element, done: () => void) => {
        dones.push(done)
      },
    })
    const Outer = compile(outInOutlet, data)
    const App = compile(
      `<template>
        <div class="root">
          <components.Outer v-if="data.alive">
            <div v-if="data.show" class="content">c</div>
          </components.Outer>
        </div>
      </template>`,
      data,
      { Outer },
    )
    const root = document.createElement('div')
    const app = createVaporApp(App)
    app.mount(root)
    data.value.show = true
    await nextTick()
    expect(root.innerHTML).toBe(
      '<div class="root"><!--if--><div class="fb">fb</div><!--slot--><!--if--></div>',
    )

    data.value.alive = false
    await nextTick()
    expect(root.innerHTML).toBe(
      '<div class="root"><div class="fb">fb</div><!--if--></div>',
    )
    dones.splice(0).forEach(done => done())
    await nextTick()
    expect(root.innerHTML).toBe('<div class="root"><!--if--></div>')
    app.unmount()
  })

  test('out-in: the outlet is deactivated while its fallback leaves', async () => {
    const dones: (() => void)[] = []
    const data = ref({
      show: false,
      which: 'a',
      onEnter: NOOP,
      onLeave: (_el: Element, done: () => void) => {
        dones.push(done)
      },
    })
    const Outer = compile(outInOutlet, data)
    const A = compile(contentApp('Outer'), data, { Outer })
    const B = compile(`<template><p>b</p></template>`, data)
    const App = compile(keepAliveApp, data, { A, B })
    const root = document.createElement('div')
    const app = createVaporApp(App)
    app.mount(root)
    data.value.show = true
    await nextTick()
    data.value.which = 'b'
    await nextTick()
    dones.splice(0).forEach(done => done())
    await nextTick()
    expect(root.innerHTML).toBe('<div class="root"><p>b</p><!--if--></div>')

    data.value.which = 'a'
    await nextTick()
    expect(root.innerHTML).toBe(
      '<div class="root"><div class="content">c</div><!--if--><!--slot--><!--if--></div>',
    )
    app.unmount()
  })

  // Held content re-renders detached while the fallback leaves: the
  // slot itself can swap out and back without touching the live DOM.
  test('out-in: the slot is swapped while its fallback leaves', async () => {
    const dones: (() => void)[] = []
    const data = ref({
      show: false,
      onEnter: NOOP,
      onLeave: (_el: Element, done: () => void) => {
        dones.push(done)
      },
    })
    const Outer = compile(outInOutlet, data)
    const App = compile(
      `<template>
        <div class="root">
          <components.Outer>
            <template v-if="data.show" #default>
              <div class="content">c</div>
            </template>
          </components.Outer>
        </div>
      </template>`,
      data,
      { Outer },
    )
    const root = document.createElement('div')
    const app = createVaporApp(App)
    app.mount(root)
    data.value.show = true
    await nextTick()
    data.value.show = false
    await nextTick()
    dones.splice(0).forEach(done => done())
    await nextTick()
    expect(root.innerHTML).toBe(
      '<div class="root"><div class="fb">fb</div><!--slot--></div>',
    )

    data.value.show = true
    await nextTick()
    dones.splice(0).forEach(done => done())
    await nextTick()
    expect(root.innerHTML).toBe(
      '<div class="root"><div class="content">c</div><!--slot--></div>',
    )
    app.unmount()
  })

  // An outlet held by an enclosing one commits its fallback without
  // placing or animating it: the enclosing outlet places both at the end
  // of its own leave, like vdom mounting the whole subtree then.
  test('a nearer fallback committed during the enclosing out-in window', () =>
    transitionLog(
      {
        Outer: transitionOutlet('out-in'),
        Middle: `
          <template>
            <components.Outer>
              <slot><i v-if="data.y" class="local">l</i></slot>
            </components.Outer>
          </template>`,
        App: contentApp('Middle'),
      },
      [
        'off',
        'done',
        'on',
        d => {
          d.show = false
          d.y = true
        },
        'done',
        'done',
        'done',
      ],
      { init: { y: false } },
    ))

  // Only the roots of held content are held: an outlet inside one of its
  // elements renders into that element.
  test.each([
    ['its local fallback', false, '<i class="local">l</i>'],
    ['content arriving during the window', true, '<b class="y">y</b>'],
  ])(
    'an outlet inside an element of held content shows %s',
    async (_, y, inner) => {
      const { vdom, vapor } = await renderParity(
        {
          Outer: `
            <template>
              <Transition mode="out-in" :css="false" @leave="data.onLeave">
                <slot><div class="fallback">fb</div></slot>
              </Transition>
            </template>`,
          Middle: `
            <template>
              <components.Outer>
                <div v-if="data.show" class="content">
                  <slot><i class="local">l</i></slot>
                </div>
              </components.Outer>
            </template>`,
          App: `
            <template>
              <components.Middle>
                <b v-if="data.y" class="y">y</b>
              </components.Middle>
            </template>`,
        },
        () => {
          const data: any = ref({
            show: false,
            y: false,
            onLeave: (_: Element, done: () => void) => {
              data.value.done = done
            },
          })
          return data
        },
        async data => {
          data.value.show = true
          await nextTick()
          data.value.y = y
          await nextTick()
          data.value.done()
          await nextTick()
        },
      )
      expect(stripAnchors(vdom.after)).toBe(
        `<div class="content">${inner}</div>`,
      )
      expect(stripAnchors(vapor.after)).toBe(stripAnchors(vdom.after))
    },
  )

  // Content already in place is not moved when it takes over again.
  test('content taking over again without a Transition stays where it is', async () => {
    const data = ref({ show: false })
    const Outer = compile(
      `<template>
        <slot><div class="fb">fb</div></slot>
      </template>`,
      data,
    )
    const App = compile(contentApp('Outer'), data, { Outer })
    const root = document.createElement('div')
    const app = createVaporApp(App)
    app.mount(root)
    const added: string[] = []
    const removed: string[] = []
    const observer = new MutationObserver(records => {
      for (const record of records) {
        record.addedNodes.forEach(n => added.push(n.nodeName))
        record.removedNodes.forEach(n => removed.push(n.nodeName))
      }
    })
    observer.observe(root, { childList: true, subtree: true })
    data.value.show = true
    await nextTick()
    await new Promise(resolve => setTimeout(resolve))
    observer.disconnect()
    expect(root.innerHTML).toBe(
      '<div class="content">c</div><!--if--><!--slot-->',
    )
    expect(added).toEqual(['DIV'])
    expect(removed).toEqual(['DIV'])
    app.unmount()
  })

  // The fallback is a branch of its own for Transition only: KeepAlive
  // still tells the branches under it apart.
  test('KeepAlive caches the branches of a fallback apart', async () => {
    const created: string[] = []
    const data = ref({
      x: true,
      create: (name: string) => (created.push(name), name),
    })
    const A = compile(
      `<template><p>{{ data.create('a') }}</p></template>`,
      data,
    )
    const B = compile(
      `<template><p>{{ data.create('b') }}</p></template>`,
      data,
    )
    const Outer = compile(
      `<template>
        <KeepAlive>
          <slot>
            <components.A v-if="data.x" />
            <components.B v-else />
          </slot>
        </KeepAlive>
      </template>`,
      data,
      { A, B },
    )
    // a Transition anywhere turns the fallback's branch identity on
    const App = compile(
      `<template>
        <Transition><i>t</i></Transition>
        <components.Outer />
      </template>`,
      data,
      { Outer },
    )
    const root = document.createElement('div')
    const app = createVaporApp(App)
    app.mount(root)
    expect(root.querySelector('p')!.textContent).toBe('a')
    for (const text of ['b', 'a', 'b']) {
      data.value.x = !data.value.x
      await nextTick()
      expect(root.querySelector('p')!.textContent).toBe(text)
    }
    expect(created).toEqual(['a', 'b'])
    app.unmount()
  })

  // A DocumentFragment used as a container is an ordinary parent.
  test('an app mounted into a DocumentFragment runs enter hooks', async () => {
    const log: string[] = []
    const data = ref({
      show: true,
      onBeforeEnter: (el: Element) => log.push('before-enter:' + el.className),
    })
    const App = compile(
      `<template>
        <Transition appear :css="false" @before-enter="data.onBeforeEnter">
          <div v-if="data.show" class="a">a</div>
        </Transition>
      </template>`,
      data,
    )
    const app = createVaporApp(App)
    app.mount(document.createDocumentFragment() as any)
    data.value.show = false
    await nextTick()
    data.value.show = true
    await nextTick()
    expect(log).toEqual(['before-enter:a', 'before-enter:a'])
    app.unmount()
  })

  test('a component inside slot content is not held by the enclosing outlet, like vdom', async () => {
    const leaving: Record<string, (string | null)[]> = { vdom: [], vapor: [] }
    await renderParity(
      {
        Card: `
          <template>
            <Transition><slot><p>card fb</p></slot></Transition>
          </template>`,
        Comp: `
          <template>
            <div class="c">
              <Teleport to="body" disabled><slot>x</slot></Teleport>
            </div>
          </template>`,
        App: `
          <template>
            <components.Card>
              <components.Comp v-if="data.ok">
                <span v-if="data.s">s</span>
              </components.Comp>
            </components.Card>
          </template>`,
      },
      () => ref({ ok: true, s: true }),
      async (data, root, mode) => {
        const c = () => {
          const el = root.querySelector('div.c')
          return el && el.textContent
        }
        for (let i = 0; i < 2; i++) {
          data.value.ok = false
          await nextTick()
          leaving[mode].push(c())
          data.value.ok = true
          await nextTick()
          leaving[mode].push(c())
        }
      },
    )
    expect(leaving.vdom).toEqual(['s', 's', 's', 's'])
    expect(leaving.vapor).toEqual(leaving.vdom)
  })

  // a slot root that left to nothing (unpaired) and rendered past its leave:
  // the branch a later leave holds is that leave's to release, whichever of
  // the two ends first
  test('a leave rendered past does not release the branch a later leave holds', () =>
    transitionLog(
      {
        Outer: transitionOutlet(
          'out-in',
          '<i v-if="data.ready" class="fallback">fb</i>',
        ),
        App: `
          <template>
            <components.Outer>
              <component :is="data.tag" :class="data.tag" />
            </components.Outer>
          </template>`,
      },
      [
        d => (d.tag = null),
        d => (d.tag = 'p'),
        d => (d.tag = 'span'),
        'done',
        'done',
      ],
      { init: { ready: false, tag: 'div' }, selector: 'div,p,span' },
    ))

  describe('the hook log after every step, like vdom', () => {
    type Step = ((data: any) => void) | 'done'
    // The hook log interleaved with the DOM after each step, from an all-vdom
    // and an all-vapor run. `done` finishes every pending leave.
    const hookLog = async (
      srcs: Record<string, string>,
      steps: Step[],
      init: Record<string, any> = {},
    ) => {
      const logs: Record<string, string[]> = {}
      await renderParity(
        srcs,
        () => {
          const data: any = ref({
            show: true,
            ...init,
            dones: [] as (() => void)[],
            be: (el: Element) => data.value.log.push('be:' + el.className),
            l: (el: Element, done: () => void) => {
              data.value.log.push('l:' + el.className)
              data.value.dones.push(done)
            },
            al: (el: Element) => data.value.log.push('al:' + el.className),
          })
          return data
        },
        async (data, root, mode) => {
          const log: string[] = (data.value.log = logs[mode] = [])
          const dom = () =>
            stripAnchors(root.innerHTML).replace(/ style=""/g, '')
          const flush = async () => {
            for (let i = 0; i < 4; i++) {
              data.value.dones.splice(0).forEach((done: () => void) => done())
              await nextTick()
            }
          }
          for (const step of steps) {
            if (step === 'done') {
              await flush()
              log.push('done ' + dom())
            } else {
              step(data.value)
              await nextTick()
              log.push(dom())
            }
          }
          await flush()
          log.push('settled ' + dom())
        },
      )
      return logs
    }
    const hooks = `:css="false" @before-enter="data.be" @leave="data.l" @after-leave="data.al"`
    const outlet = (
      mode: string,
      fallback = '<div class="fallback">fb</div>',
    ) => `
      <template>
        <Transition ${mode ? `mode="${mode}"` : ''} ${hooks}>
          <slot>${fallback}</slot>
        </Transition>
      </template>`
    const count = (log: string[], entry: string) =>
      log.filter(e => e === entry).length
    // the frames after every leave finished
    const settled = (log: string[]) =>
      log.filter(e => e.startsWith('done ') || e.startsWith('settled '))
    // the DOM after every step, hooks left out
    const frames = (log: string[]) => log.filter(e => !/^(be|l|al):/.test(e))
    const modes = ['', 'out-in', 'in-out']

    test.each(modes)(
      'mode "%s": v-for content enters once after the fallback',
      async mode => {
        const logs = await hookLog(
          {
            Outer: outlet(mode),
            App: `
              <template>
                <components.Outer>
                  <div v-for="i in data.items" :key="i" :class="'i' + i">
                    {{ i }}
                  </div>
                </components.Outer>
              </template>`,
          },
          [d => (d.items = []), 'done', d => (d.items = [2]), 'done'],
          { items: [1] },
        )
        expect(count(logs.vdom, 'be:i2')).toBe(1)
        expect(count(logs.vapor, 'be:i2')).toBe(1)
        expect(settled(logs.vapor)).toEqual(settled(logs.vdom))
      },
    )

    test('TransitionGroup: list items enter once after an empty-list fallback', async () => {
      const logs = await hookLog(
        {
          List: `
            <template>
              <TransitionGroup tag="ul" ${hooks}>
                <slot><li key="empty" class="empty">none</li></slot>
              </TransitionGroup>
            </template>`,
          App: `
            <template>
              <components.List>
                <li v-for="i in data.items" :key="i" :class="'i' + i">
                  {{ i }}
                </li>
              </components.List>
            </template>`,
        },
        [d => (d.items = []), 'done', d => (d.items = [1, 2]), 'done'],
        { items: [1] },
      )
      expect(count(logs.vdom, 'be:i2')).toBe(1)
      expect(count(logs.vapor, 'be:i2')).toBe(1)
      expect(settled(logs.vapor)).toEqual(settled(logs.vdom))
    })

    const itemRows = `
      <template>
        <div class="root">
          <components.Item v-for="x in data.list" :key="x">
            <div v-if="data['r' + x]" :class="'c' + x">{{ x }}</div>
          </components.Item>
        </div>
      </template>`

    test('out-in: a row inserted beside an outlet in its leave window keeps its place', async () => {
      const logs = await hookLog(
        { Item: outlet('out-in', '<p class="fb">fb</p>'), App: itemRows },
        [d => (d.r2 = true), d => (d.list = [1, 3, 2]), 'done'],
        { list: [1, 2], r1: false, r2: false, r3: false },
      )
      expect(settled(logs.vapor)).toEqual(settled(logs.vdom))
    })

    test('out-in: rows reordered while one is in its leave window', async () => {
      const logs = await hookLog(
        { Item: outlet('out-in', '<p class="fb">fb</p>'), App: itemRows },
        [d => (d.r1 = true), d => (d.list = [2, 1]), 'done'],
        { list: [1, 2], r1: false, r2: true },
      )
      expect(settled(logs.vapor)).toEqual(settled(logs.vdom))
    })

    // The held rows are out of the DOM while their outlet's fallback leaves:
    // the keyed list moving the outlets locates them by an attached node.
    test.each([[[2, 1, 3]], [[3, 2, 1]]])(
      'out-in: outlets reordered to %j while one holds its content',
      async order => {
        const logs = await hookLog(
          { Item: outlet('out-in', '<p class="fb">fb</p>'), App: itemRows },
          [d => (d.r2 = true), d => (d.list = order), 'done'],
          { list: [1, 2, 3], r1: false, r2: false, r3: false },
        )
        expect(frames(logs.vapor)).toEqual(frames(logs.vdom))
      },
    )

    describe('a forwarded outlet with a local fallback under the enclosing one', () => {
      const srcs = (mode: string) => ({
        Outer: outlet(mode),
        Mid: `
          <template>
            <components.Outer>
              <slot><div v-if="data.y" class="local">l</div></slot>
            </components.Outer>
          </template>`,
        App: contentApp('Mid'),
      })
      test('the local fallback takes over', async () => {
        const logs = await hookLog(srcs(''), [d => (d.y = true), 'done'], {
          show: false,
          y: false,
        })
        expect(logs.vapor).toEqual(logs.vdom)
      })
      test('the local fallback leaves', async () => {
        const logs = await hookLog(srcs(''), [d => (d.y = false), 'done'], {
          show: false,
          y: true,
        })
        expect(logs.vapor).toEqual(logs.vdom)
      })
      test('in-out: the enclosing fallback leaves once the local one took over', async () => {
        const logs = await hookLog(
          srcs('in-out'),
          [d => (d.y = true), 'done'],
          { show: false, y: false },
        )
        expect(count(logs.vdom, 'l:fallback')).toBe(1)
        expect(count(logs.vapor, 'l:fallback')).toBe(1)
        expect(settled(logs.vapor)).toEqual(settled(logs.vdom))
      })
    })

    describe('multi-root content', () => {
      const srcs = (mode: string) => ({
        Outer: outlet(mode),
        App: `
          <template>
            <components.Outer>
              <div v-if="data.show" class="content">c</div>
              <div v-if="data.alt" class="alt">a</div>
            </components.Outer>
          </template>`,
      })
      test.each(['', 'in-out'])(
        'mode "%s": a second root takes over from the fallback',
        async mode => {
          const logs = await hookLog(
            srcs(mode),
            [d => (d.alt = true), 'done'],
            { show: false, alt: false },
          )
          expect(settled(logs.vapor)).toEqual(settled(logs.vdom))
        },
      )
      test('in-out: the roots swap in one tick', async () => {
        const logs = await hookLog(
          srcs('in-out'),
          [
            d => {
              d.show = false
              d.alt = true
            },
            'done',
          ],
          { alt: false },
        )
        expect(settled(logs.vapor)).toEqual(settled(logs.vdom))
      })
    })

    test.each(modes)(
      'mode "%s": a Symbol key on the fallback root',
      async mode => {
        const logs = await hookLog(
          {
            Outer: outlet(
              mode,
              '<div :key="data.sym" class="fallback">fb</div>',
            ),
            App: contentApp('Outer'),
          },
          [d => (d.show = false), 'done', d => (d.show = true), 'done'],
          { sym: Symbol('k') },
        )
        expect(settled(logs.vapor)).toEqual(settled(logs.vdom))
      },
    )

    test('out-in: content arriving while a fallback root leaves shows afterwards', async () => {
      const logs = await hookLog(
        {
          Outer: outlet('out-in', '<i v-if="data.m" class="fb">fb</i>'),
          App: `
            <template>
              <components.Outer>
                <span v-if="data.c" class="c">c</span>
              </components.Outer>
            </template>`,
        },
        [
          d => (d.c = true),
          'done',
          d => (d.c = false),
          'done',
          d => (d.m = false),
          d => (d.c = true),
          'done',
        ],
        { c: false, m: true },
      )
      expect(settled(logs.vapor)).toEqual(settled(logs.vdom))
    })

    test('out-in: the nearest fallback wins after a window the enclosing outlet re-read', async () => {
      const logs = await hookLog(
        {
          Outer: outlet('out-in', '<div class="ofb">ofb</div>'),
          Mid: `
            <template>
              <components.Outer>
                <template #default>
                  <slot><div class="mfb">mfb</div></slot>
                </template>
                <template v-if="data.n" #extra>x</template>
              </components.Outer>
            </template>`,
          App: contentApp('Mid'),
        },
        [
          d => (d.show = true),
          d => (d.show = false),
          d => (d.n = true),
          'done',
          d => (d.show = true),
          'done',
        ],
        { show: false, n: false },
      )
      expect(settled(logs.vapor)).toEqual(settled(logs.vdom))
    })

    test.each(modes)(
      'mode "%s": a plain element child toggling while the outlet holds',
      async mode => {
        const logs = await hookLog(
          {
            Outer: outlet(mode, '<p>fb</p>'),
            App: `
              <template>
                <components.Outer>
                  <component :is="data.tag"><b v-if="data.x">b</b></component>
                </components.Outer>
              </template>`,
          },
          [
            d => (d.tag = 'div'),
            d => (d.x = true),
            'done',
            d => (d.x = false),
            d => (d.x = true),
          ],
          { tag: null, x: false },
        )
        expect(settled(logs.vapor)).toEqual(settled(logs.vdom))
      },
    )

    // The leave a deactivation started is overtaken by the reactivation: its
    // end must not put the element back where the deactivation was taking it.
    test.each([
      ['slot content of an outlet with a fallback', '', contentApp('Outer')],
      [
        'slot content of an outlet with a fallback',
        'in-out',
        contentApp('Outer'),
      ],
      [
        'a plain branch',
        '',
        `<template>
          <Transition ${hooks}>
            <div v-if="data.show" class="content">c</div>
            <div v-else class="fallback">fb</div>
          </Transition>
        </template>`,
      ],
    ])(
      'KeepAlive reactivating %s (mode "%s") while its leave is pending',
      async (_, mode, a) => {
        const logs = await hookLog(
          {
            Outer: outlet(mode),
            A: a,
            B: `<template><p class="b">b</p></template>`,
            App: keepAliveApp,
          },
          [
            d => (d.show = true),
            d => (d.which = 'b'),
            d => (d.which = 'a'),
            'done',
            d => (d.show = false),
            'done',
          ],
          { show: false, which: 'a' },
        )
        expect(settled(logs.vapor)).toEqual(settled(logs.vdom))
      },
    )

    describe('in-out: a chain whose taken branch goes away leaves', () => {
      const steps: Step[] = [
        d => (d.x = true),
        'done',
        d => (d.x = false),
        'done',
        d => (d.y = true),
        'done',
        d => (d.y = false),
        'done',
      ]
      const init = { x: false, y: false }
      const chain = `
        <b v-if="data.x" class="x">x</b>
        <i v-else-if="data.y" class="y">y</i>`
      test.each([
        [
          'slot content',
          {
            Card: outlet('in-out', '<p class="fb">fb</p>'),
            App: `
              <template>
                <components.Card>${chain}</components.Card>
              </template>`,
          },
        ],
        [
          'forwarded slot content',
          {
            Outer: outlet('in-out', '<p class="fb">fb</p>'),
            Card: `
              <template>
                <components.Outer><slot /></components.Outer>
              </template>`,
            App: `
              <template>
                <components.Card>${chain}</components.Card>
              </template>`,
          },
        ],
        [
          'slot content with an empty v-else',
          {
            Card: outlet('in-out', '<p class="fb">fb</p>'),
            App: `
              <template>
                <components.Card>
                  <b v-if="data.x" class="x">x</b>
                  <template v-else-if="data.y"><i class="y">y</i></template>
                  <template v-else></template>
                </components.Card>
              </template>`,
          },
        ],
        [
          'no slot',
          {
            App: `
              <template>
                <Transition mode="in-out" ${hooks}>${chain}</Transition>
              </template>`,
          },
        ],
      ])('%s', async (_, srcs) => {
        const logs = await hookLog(srcs as Record<string, string>, steps, init)
        expect(settled(logs.vapor)).toEqual(settled(logs.vdom))
      })
    })
  })

  describe('v-for slot root under a Transition outlet', () => {
    // held rows are not in the DOM: a reorder meanwhile keeps them out as
    // well, the placement at the end of the leave orders them
    test('rows reordered while held are placed after the leave, like vdom', () =>
      transitionLog(
        {
          Outer: transitionOutlet('out-in'),
          Item: `<template><div class="item">item</div></template>`,
          App: `
            <template>
              <components.Outer>
                <template v-for="i in data.items" :key="i">
                  <components.Item v-if="i === 2" />
                </template>
              </components.Outer>
            </template>`,
        },
        [
          d => (d.items = [1, 2]),
          d => (d.items = [2, 1]),
          d => (d.items = [2]),
          'done',
        ],
        { init: { items: [] } },
      ))

    test('rows arriving while the fallback leaves are held and entered when placed, like vdom', async () => {
      const logs: Record<string, string[]> = {}
      await renderParity(
        {
          Outlet: `
            <template>
              <Transition
                mode="out-in"
                :css="false"
                @before-enter="data.be"
                @enter="data.e"
                @after-enter="data.ae"
                @before-leave="data.bl"
                @leave="data.l"
                @after-leave="data.al"
              >
                <slot><p>fb</p></slot>
              </Transition>
            </template>`,
          App: `
            <template>
              <components.Outlet>
                <b v-for="i in data.items" :key="i">{{ i }}</b>
              </components.Outlet>
            </template>`,
        },
        () => {
          const data: any = ref({
            items: [] as number[],
            dones: [] as (() => void)[],
            log: [] as string[],
            be: (el: Element) => data.value.log.push('be:' + el.textContent),
            e: (el: Element, done: () => void) => {
              data.value.log.push('e:' + el.textContent)
              data.value.dones.push(done)
            },
            ae: (el: Element) => data.value.log.push('ae:' + el.textContent),
            bl: (el: Element) => data.value.log.push('bl:' + el.textContent),
            l: (el: Element, done: () => void) => {
              data.value.log.push('l:' + el.textContent)
              data.value.dones.push(done)
            },
            al: (el: Element) => data.value.log.push('al:' + el.textContent),
          })
          return data
        },
        async (data, root, mode) => {
          const log: string[] = (logs[mode] = data.value.log)
          data.value.items = [1]
          await nextTick()
          log.push('items=[1] ' + stripAnchors(root.innerHTML))
          let n = 0
          while (data.value.dones.length && n++ < 10) {
            data.value.dones.shift()!()
            await nextTick()
          }
          log.push('settled ' + stripAnchors(root.innerHTML))
        },
      )
      expect(logs.vapor).toEqual(logs.vdom)
    })

    // rows in the DOM turn invalid (the fallback shows and holds the root),
    // then the list clears: the rows and their anchors go, nothing accumulates
    test('rows cleared while the fallback shows are removed with their anchors', async () => {
      const frames: Record<string, string[]> = {}
      await renderParity(
        {
          Outlet: `
            <template>
              <Transition :css="false"><slot><p>fb</p></slot></Transition>
            </template>`,
          App: `
            <template>
              <components.Outlet>
                <template v-for="i in data.list" :key="i">
                  <b v-if="data.on">{{ i }}</b>
                </template>
              </components.Outlet>
            </template>`,
        },
        () => ref({ list: [] as number[], on: true }),
        async (data, root, mode) => {
          const seen: string[] = (frames[mode] = [])
          for (let i = 0; i < 3; i++) {
            data.value.on = true
            data.value.list = [1]
            await nextTick()
            data.value.on = false
            await nextTick()
            data.value.list = []
            await nextTick()
            seen.push(root.innerHTML)
          }
        },
      )
      // the same DOM after every cycle, in both modes
      expect(frames.vapor[1]).toBe(frames.vapor[0])
      expect(frames.vapor[2]).toBe(frames.vapor[0])
      expect(frames.vdom[2]).toBe(frames.vdom[0])
      expect(stripAnchors(frames.vapor[0])).toBe(stripAnchors(frames.vdom[0]))
    })

    // the outer keyed list prepends a row while this row's v-for content waits
    // behind the fallback's out-in leave: the held rows are out of the DOM, so
    // the row is located by its list anchor, and the new row lands ahead of it
    test('a row prepended while a sibling row holds its v-for content lands ahead of it', async () => {
      const texts: Record<string, string> = {}
      await renderParity(
        {
          Outlet: `
            <template>
              <Transition mode="out-in" :css="false" @leave="data.leave">
                <slot><p>fb</p></slot>
              </Transition>
            </template>`,
          App: `
            <template>
              <div>
                <components.Outlet v-for="r in data.rows" :key="r">
                  <i v-for="j in data.inner" :key="j">{{ r }}-{{ j }},</i>
                </components.Outlet>
              </div>
            </template>`,
        },
        () => {
          const dones: (() => void)[] = []
          return ref({
            rows: [1],
            inner: [] as number[],
            dones,
            leave: (_el: Element, done: () => void) => dones.push(done),
          })
        },
        async (data, root, mode) => {
          data.value.inner = [1]
          await nextTick()
          data.value.rows = [2, 1]
          await nextTick()
          let n = 0
          while (data.value.dones.length && n++ < 10) {
            data.value.dones.shift()!()
            await nextTick()
          }
          texts[mode] = root.textContent!
        },
      )
      expect(texts.vdom).toBe('2-1,1-1,')
      expect(texts.vapor).toBe(texts.vdom)
    })

    // the row's first node is the outlet; its content switched twice while the
    // fallback leaves (the second branch renders held, out of the DOM): the
    // row is still located by an attached node, and a prepended row lands ahead
    test('a row prepended while a sibling row switches held slot content twice lands ahead of it', async () => {
      const texts: Record<string, string> = {}
      await renderParity(
        {
          Outlet: `
            <template>
              <Transition mode="out-in" :css="false" @leave="data.leave">
                <slot :name="data.name"><p>fb</p></slot>
              </Transition>
            </template>`,
          App: `
            <template>
              <div>
                <template v-for="r in data.rows" :key="r">
                  <components.Outlet>
                    <template #a><i>a</i></template>
                    <template #b><i>b</i></template>
                  </components.Outlet>
                  <span>{{ r }},</span>
                </template>
              </div>
            </template>`,
        },
        () => {
          const dones: (() => void)[] = []
          return ref({
            rows: [1],
            name: 'missing',
            dones,
            leave: (_el: Element, done: () => void) => dones.push(done),
          })
        },
        async (data, root, mode) => {
          data.value.name = 'a'
          await nextTick()
          data.value.name = 'b'
          await nextTick()
          data.value.rows = [2, 1]
          await nextTick()
          let n = 0
          while (data.value.dones.length && n++ < 10) {
            data.value.dones.shift()!()
            await nextTick()
          }
          texts[mode] = root.textContent!
        },
      )
      expect(texts.vdom).toBe('b2,b1,')
      expect(texts.vapor).toBe(texts.vdom)
    })
  })

  // Content held while the fallback leaves is out of the DOM: a move of the
  // whole outlet meanwhile carries the content's anchor only, and the outlet
  // places the content once the leave ends.
  describe('held content moved with its outlet, like vdom', () => {
    const hostContents: Record<string, string> = {
      component: `<components.Item v-if="data.show" />`,
      'v-for rows of components': `
        <template v-for="i in data.show ? [1] : []" :key="i">
          <components.Item />
        </template>`,
    }
    const movers: [string, string, Parameters<typeof transitionLog>[1]][] = [
      [
        'a KeepAlive deactivating and reactivating it',
        `<template>
          <KeepAlive>
            <components.Host v-if="data.alive" />
          </KeepAlive>
        </template>`,
        ['on', d => (d.alive = false), d => (d.alive = true), 'done'],
      ],
      [
        'a keyed v-for reordering it',
        `<template>
          <components.Host v-for="i in data.order" :key="i" />
        </template>`,
        ['on', d => (d.order = [2, 1]), 'done', 'done'],
      ],
    ]
    describe.each(movers)('%s', (_, App, steps) => {
      test.each(Object.entries(hostContents))('%s', (_, content) =>
        transitionLog(
          {
            Outer: transitionOutlet('out-in'),
            Item: `<template><div class="item">item</div></template>`,
            Host: `
              <template>
                <components.Outer>${content}</components.Outer>
              </template>`,
            App,
          },
          steps,
          { init: { show: false, alive: true, order: [1, 2] } },
        ),
      )
    })
  })

  // An async setup component in held content has no block until its outlet
  // places it. Async setup needs a Suspense, which only vdom provides, so
  // the root is vdom in both modes.
  describe('held content with an async setup moved with its outlet, like vdom', () => {
    const hostContents: Record<string, string> = {
      'an async setup component': `<components.AsyncItem v-if="data.show" />`,
      'a component rooted in one': `<components.Wrapper v-if="data.show" />`,
    }
    const movers: [
      string,
      string,
      Parameters<typeof transitionLog>[1],
      Record<string, any>,
      boolean?,
    ][] = [
      [
        'a KeepAlive deactivating and reactivating it',
        `<template>
          <KeepAlive>
            <components.Host v-if="data.alive" />
          </KeepAlive>
        </template>`,
        ['on', d => (d.alive = false), d => (d.alive = true), 'done'],
        { alive: true },
      ],
      [
        'a keyed v-for reordering it',
        `<template>
          <components.Host v-for="i in data.order" :key="i" />
        </template>`,
        ['on', d => (d.order = [2, 1]), 'done', 'done'],
        { order: [1, 2] },
      ],
      // vdom lands the new row after the leaving fallback, so only the
      // settled DOM is compared
      [
        'a keyed v-for inserting a row before it',
        `<template>
          <components.Host v-for="i in data.order" :key="i" />
        </template>`,
        ['on', d => (d.order = [1, 2]), 'done'],
        { order: [2] },
        true,
      ],
    ]
    describe.each(movers)('%s', (_, Mover, steps, init, settledOnly) => {
      test.each(Object.entries(hostContents))('%s', async (_, content) => {
        const srcs: Record<string, string> = {
          Outer: transitionOutlet('out-in'),
          AsyncItem: `
            <script setup>
            await Promise.resolve()
            </script>
            <template><div class="item">item</div></template>`,
          Wrapper: `<template><components.AsyncItem /></template>`,
          Host: `
            <template>
              <components.Outer>${content}</components.Outer>
            </template>`,
          Mover,
          App: `
            <template>
              <Suspense><components.Mover /></Suspense>
            </template>`,
        }
        const logs: Record<string, string[]> = {}
        for (const vapor of [false, true]) {
          const log: string[] = (logs[vapor ? 'vapor' : 'vdom'] = [])
          const data: any = ref({
            show: false,
            ...init,
            dones: [] as (() => void)[],
            onEnter: (el: Element) => log.push('enter:' + el.className),
            onLeave: (el: Element, done: () => void) => {
              log.push('leave:' + el.className)
              data.value.dones.push(done)
            },
          })
          const components: Record<string, any> = {}
          for (const name in srcs) {
            const src = srcs[name].includes('<script')
              ? srcs[name]
              : `<script setup>const data = _data; const components = _components;</script>` +
                srcs[name]
            components[name] = compile(src, data, components, {
              vapor: vapor && name !== 'App',
            })
          }
          const root = document.createElement('div')
          const app = createApp(components.App).use(vaporInteropPlugin)
          app.mount(root)
          for (const step of steps) {
            if (step === 'done') {
              const done = data.value.dones.shift()
              if (done) done()
            } else if (isString(step)) {
              data.value.show = step === 'on'
            } else {
              step(data.value)
            }
            await new Promise(r => setTimeout(r))
            const dom = Array.from(root.querySelectorAll('div'))
              .map(el => el.className)
              .join(',')
            log.push((isString(step) ? step : 'set') + ' ' + dom)
          }
          if (settledOnly) log.splice(0, log.length - 1)
          app.unmount()
        }
        expect(logs.vapor).toEqual(logs.vdom)
      })
    })
  })
})

describe('a fallback already leaving on its own', () => {
  type Step = string | ((data: any) => void)
  // vapor vs vdom: the DOM after every step and the hook order; `k=v` sets,
  // `doneAll` drains the hook callbacks, a function mutates in place
  async function parity(
    srcs: Record<string, string>,
    init: Record<string, any>,
    steps: Step[],
    attach = false,
  ) {
    const logs: Record<string, string[]> = {}
    await renderParity(
      srcs,
      () => {
        const data: any = ref({
          ...init,
          dones: [] as (() => void)[],
          log: [] as string[],
          e: (el: Element, done: () => void) => {
            data.value.log.push('e:' + el.textContent)
            data.value.dones.push(done)
          },
          l: (el: Element, done: () => void) => {
            data.value.log.push('l:' + el.textContent)
            data.value.dones.push(done)
          },
        })
        return data
      },
      async (data, root, mode) => {
        // vapor's v-show checks isConnected
        if (attach) document.body.append(root)
        try {
          const log: string[] = (logs[mode] = data.value.log)
          for (const s of steps) {
            if (!isString(s)) {
              s(data)
            } else if (s === 'doneAll') {
              let n = 0
              while (data.value.dones.length && n++ < 20) {
                data.value.dones.shift()!()
                await nextTick()
              }
            } else {
              const [k, v] = s.split('=')
              data.value[k] = v === 'true' ? true : v === 'false' ? false : v
            }
            await nextTick()
            log.push(
              (isString(s) ? s : 'set') + ' ' + stripAnchors(root.innerHTML),
            )
          }
        } finally {
          if (attach) root.remove()
        }
      },
    )
    expect(logs.vapor).toEqual(logs.vdom)
  }

  const outIn = (body: string, props = '') => `
    <template>
      <Transition mode="out-in" :css="false" ${props} @enter="data.e" @leave="data.l">
        ${body}
      </Transition>
    </template>`
  const contentApp = `
    <template>
      <components.Outlet>
        <b v-if="data.show">c</b>
      </components.Outlet>
    </template>`

  test('content arriving while the fallback root already left does not wait, like vdom', () =>
    parity(
      {
        Outlet: outIn(`<slot><p v-if="data.fb">fb</p></slot>`),
        App: contentApp,
      },
      { fb: true, show: false },
      ['fb=false', 'show=true', 'doneAll'],
    ))

  test('an outlet swapped out and back while its fallback leaves defers like a branch of its own', () =>
    parity(
      {
        Outlet: outIn(`
          <slot v-if="data.a"><p>fb</p></slot>
          <i v-else>off</i>`),
        App: contentApp,
      },
      { a: true, show: false },
      ['show=true', 'a=false', 'a=true', 'doneAll'],
    ))

  // a Transition prop change re-resolves hooks for the current root, which is
  // the leaving element until the leave ends: it keeps the hooks running its
  // leave, as vdom's unmounted child does, so the content's wait still ends
  test('a prop changed while the fallback root leaves keeps the leave the content waits on', () =>
    parity(
      {
        Outlet: outIn(
          `<slot><p v-if="data.fb">fb</p><i v-else>alt</i></slot>`,
          ':appear="data.appear"',
        ),
        App: contentApp,
      },
      { fb: true, show: false, appear: false },
      ['fb=false', 'appear=true', 'show=true', 'doneAll'],
    ))

  test('a prop changed while the outlet swaps out and back keeps the leave the branch waits on', () =>
    parity(
      {
        Outlet: outIn(
          `
          <slot v-if="data.a"><p>fb</p></slot>
          <i v-else>off</i>`,
          ':appear="data.appear"',
        ),
        App: contentApp,
      },
      { a: true, show: false, appear: false },
      ['show=true', 'appear=true', 'a=false', 'a=true', 'doneAll'],
    ))

  // the refresh that leaves the leaving root alone still tracks the props:
  // the root rendered after the leave sees later changes
  const swapLeave = (tag: string) => (data: any) => {
    data.value.leave = (el: Element, done: () => void) => {
      data.value.log.push(tag + ':' + el.textContent)
      data.value.dones.push(done)
    }
  }
  test('a handler swapped during and after the fallback root leave reaches the next root', () =>
    parity(
      {
        Outlet: `
          <template>
            <Transition mode="out-in" :css="false" @leave="data.leave">
              <slot><p v-if="data.fb">fb</p><i v-else v-show="data.vis">alt</i></slot>
            </Transition>
          </template>`,
        App: `<template><components.Outlet></components.Outlet></template>`,
      },
      { fb: true, vis: true, leave: NOOP },
      [
        swapLeave('l1'),
        'fb=false',
        swapLeave('l2'),
        'doneAll',
        swapLeave('l3'),
        'vis=false',
      ],
      true,
    ))

  test.each(['out-in', 'in-out', 'default'])(
    'content arriving during the fallback root v-show leave takes over at once: %s',
    async mode => {
      const clean = (s: string) => stripAnchors(s).replace(/ style=""/g, '')
      const result = await renderParity(
        {
          Outlet: `
            <template>
              <Transition mode="${mode}" :css="false" @leave="data.leave">
                <slot><p v-show="data.visible">fallback</p></slot>
              </Transition>
            </template>`,
          App: `
            <template>
              <components.Outlet>
                <b v-if="data.show">content</b>
              </components.Outlet>
            </template>`,
        },
        () => {
          const dones: (() => void)[] = []
          return ref({
            show: false,
            visible: true,
            dones,
            leave: (_el: Element, done: () => void) => dones.push(done),
          })
        },
        async (data, root) => {
          document.body.append(root)
          try {
            data.value.visible = false
            await nextTick()
            data.value.show = true
            await nextTick()
            while (data.value.dones.length) {
              data.value.dones.shift()!()
              await nextTick()
            }
          } finally {
            root.remove()
          }
        },
      )
      expect(clean(result.vdom.after)).toBe('<b>content</b>')
      expect(clean(result.vapor.after)).toBe(clean(result.vdom.after))
    },
  )

  // CSS out-in: the fallback root's own leave and the one the content asks for
  // land on the same element, whose callbacks would override each other and
  // freeze every later update. Hidden, that leave is the root's (structural),
  // not v-show's, so the content waits for it all the same.
  test.each([
    ['', '<p v-if="data.fb">fb</p>'],
    [' hidden by v-show', '<p v-if="data.fb" v-show="data.visible">fb</p>'],
  ])(
    'content arriving while the fallback root leaves under CSS out-in sequences later updates%s',
    async (_, fallback) => {
      vi.useFakeTimers()
      vi.stubGlobal('requestAnimationFrame', (cb: () => void) =>
        setTimeout(cb, 0),
      )
      const frames: Record<string, string[]> = {}
      try {
        await renderParity(
          {
            Outlet: `
              <template>
                <Transition mode="out-in" :duration="20">
                  <slot>${fallback}</slot>
                </Transition>
              </template>`,
            App: contentApp,
          },
          () => ref({ fb: true, visible: false, show: false }),
          async (data, root, mode) => {
            document.body.append(root)
            frames[mode] = []
            try {
              data.value.fb = false
              await nextTick()
              for (const show of [true, false, true]) {
                data.value.show = show
                await nextTick()
                await vi.advanceTimersByTimeAsync(100)
                frames[mode].push(root.textContent!)
              }
            } finally {
              root.remove()
            }
          },
        )
        expect(frames.vdom).toEqual(['c', '', 'c'])
        expect(frames.vapor).toEqual(frames.vdom)
      } finally {
        vi.useRealTimers()
        vi.unstubAllGlobals()
      }
    },
  )
})
