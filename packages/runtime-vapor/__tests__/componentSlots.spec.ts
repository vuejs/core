// NOTE: This test is implemented based on the case of `runtime-core/__test__/componentSlots.spec.ts`.

import {
  VaporTeleport,
  child,
  createComponent,
  createDynamicComponent,
  createFor,
  createForSlots,
  createIf,
  createSlot,
  createVaporApp,
  createVaporSSRApp,
  defineVaporAsyncComponent,
  defineVaporComponent,
  insert,
  prepend,
  remove,
  renderEffect,
  setInsertionState,
  template,
  txt,
  vaporInteropPlugin,
} from '../src'
import {
  type Ref,
  createApp,
  createSlots,
  currentInstance,
  h,
  nextTick,
  onScopeDispose,
  ref,
  renderSlot,
  shallowRef,
  toDisplayString,
  useSlots,
} from '@vue/runtime-dom'
import {
  VaporBlockShape,
  VaporDynamicComponentFlags,
  VaporIfFlags,
  VaporSlotFlags,
  VaporVForFlags,
  extend,
} from '@vue/shared'
import { compile, makeRender } from './_utils'
import type { DynamicSlot } from '../src/componentSlots'
import { setElementText, setText } from '../src/dom/prop'
import { type Block, type BlockFn, isValidBlock } from '../src/block'
import {
  hydrateNode,
  isHydrationAnchor,
  setCurrentHydrationNode,
  setIsHydratingEnabled,
} from '../src/dom/hydration'
import { DynamicFragment, SlotFragment, VaporFragment } from '../src/fragment'
import {
  type SlotBoundaryContext,
  currentSlotBoundary,
  trackSlotBoundaryDirtying,
  withSlotBoundary,
} from '../src/slotBoundary'
import {
  type SlotFallbackState,
  markSlotFallbackDirty,
  recheckSlotFallback,
} from '../src/slotFragment'
import {
  getCurrentSlotEndAnchor,
  hydrateDynamicFragmentAnchor,
  isHydratingSlotFallbackActive,
  withHydratingSlotBoundary,
  withHydratingSlotFallbackActive,
} from '../src/dom/hydrateFragment'

const define = makeRender<any>()
const keyedIfShape =
  VaporBlockShape.SINGLE_ROOT | (1 << VaporIfFlags.INDEX_SHIFT)
const slotRootIfShape = VaporBlockShape.SINGLE_ROOT | VaporIfFlags.SLOT_ROOT
const keyedSlotRootIfShape = keyedIfShape | VaporIfFlags.SLOT_ROOT
const slotRootForFlags = VaporVForFlags.SLOT_ROOT
const nonStableSlot = { _: VaporSlotFlags.NON_STABLE } as const

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

function createTestSlotFallbackState(options: {
  fallback?: BlockFn
  content?: Block
  parentNode?: ParentNode | null
  anchor?: Node | null
  isBusy?: () => boolean
  isContentValid?: () => boolean
  isDisposed?: () => boolean
}): SlotFallbackState {
  let state!: SlotFallbackState
  const boundary: SlotBoundaryContext = {
    parent: null,
    getFallback: () => options.fallback,
    run: fn => fn(),
    markDirty: () => markSlotFallbackDirty(state),
  }
  state = {
    boundary,
    activeFallback: null,
    pendingRecheck: false,
    isRenderingFallback: false,
    getContent: () => options.content || [],
    getParentNode: () => options.parentNode || null,
    getAnchor: () => options.anchor || null,
    isBusy: options.isBusy || (() => false),
    isDisposed: options.isDisposed || (() => false),
    isContentValid:
      options.isContentValid || (() => isValidBlock(options.content || [])),
    syncNodes: () => {},
    notifyFallbackValidityChange: vi.fn(),
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

  describe('slot fallback boundary', () => {
    test('slot fragment insert uses active fallback output', () => {
      const container = document.createElement('div')
      const frag = new SlotFragment()

      frag.updateSlot(undefined, () => document.createTextNode('fallback'))

      insert(frag, container)

      expect(container.innerHTML).toBe('fallback<!--slot-->')
    })

    test('slot fragment validity uses active fallback output', () => {
      const frag = new SlotFragment()

      frag.updateSlot(undefined, () => document.createTextNode('fallback'))

      expect(isValidBlock(frag)).toBe(true)
    })

    test('slot fragment validityPending takes precedence over effective output', () => {
      const frag = new SlotFragment()

      frag.validityPending = true

      expect(isValidBlock(frag)).toBe(true)
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

    test('slot fragment prefers local fallback over inherited fallback', () => {
      const localFallback = vi.fn(() =>
        document.createTextNode('local fallback'),
      )
      const inheritedFallback = vi.fn(() =>
        document.createTextNode('inherited fallback'),
      )
      const parentBoundary: SlotBoundaryContext = {
        parent: null,
        getFallback: () => inheritedFallback,
        run: fn => fn(),
        markDirty: vi.fn(),
      }
      const frag = withSlotBoundary(parentBoundary, () => new SlotFragment())

      frag.updateSlot(undefined, localFallback)

      expect(frag.activeFallback).toBeInstanceOf(Text)
      expect((frag.activeFallback as Text).textContent).toBe('local fallback')
      expect(localFallback).toHaveBeenCalled()
      expect(inheritedFallback).not.toHaveBeenCalled()
    })

    test('slot fragment local fallback renders nested slots against the parent boundary', () => {
      const parentBoundary: SlotBoundaryContext = {
        parent: null,
        getFallback: () => () => document.createTextNode('outer fallback'),
        run: (fn: () => any) => fn(),
        markDirty: vi.fn(),
      }
      const frag = withSlotBoundary(parentBoundary, () => new SlotFragment())
      let fallbackBoundary: any

      frag.updateSlot(undefined, () => {
        fallbackBoundary = currentSlotBoundary
        return []
      })

      // Fallback body renders under a redirected boundary whose `.parent` is
      // the owning boundary's parent — so nested slots inherit from the
      // grandparent, avoiding fallback -> <slot> -> same fallback recursion.
      expect(fallbackBoundary).not.toBe(frag.boundary)
      expect(fallbackBoundary.parent).toBe(parentBoundary)
    })

    test('slot fragment local fallback keeps itself as owner for nested fragments', () => {
      const container = document.createElement('div')
      const parentBoundary: SlotBoundaryContext = {
        parent: null,
        getFallback: () => () => document.createTextNode('outer fallback'),
        run: (fn: () => any) => fn(),
        markDirty: vi.fn(),
      }
      const frag = withSlotBoundary(parentBoundary, () => new SlotFragment())
      const child = new DynamicFragment('if', false, false)
      let initialized = false

      frag.updateSlot(undefined, () => {
        if (!initialized) {
          initialized = true
          trackSlotBoundaryDirtying(child)
          child.update(() => document.createTextNode('inner fallback'))
        }
        return child
      })
      insert(frag, container)

      expect(container.innerHTML).toBe('inner fallback<!--if--><!--slot-->')

      child.update(() => [])

      expect(container.innerHTML).toBe('outer fallback<!--slot-->')
    })

    test('slot fragment local fallback ignores unrelated ancestor fallback refs', async () => {
      const ancestorText = ref('outer fallback')
      const localFallback = vi.fn(() =>
        document.createTextNode('local fallback'),
      )
      const container = document.createElement('div')
      const parentBoundary: SlotBoundaryContext = {
        parent: null,
        getFallback: () => () => document.createTextNode(ancestorText.value),
        run: (fn: () => any) => fn(),
        markDirty: vi.fn(),
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

    test('slot fragment switches local fallback and root v-if content without keeping the inactive anchor in DOM', async () => {
      const show = ref(false)
      const Child = defineVaporComponent(() =>
        createSlot('default', null, () => document.createTextNode('fallback')),
      )
      const { host } = define(() =>
        createComponent(Child, null, {
          default: extend(
            () =>
              createIf(
                () => show.value,
                () => document.createTextNode('content'),
                undefined,
                keyedSlotRootIfShape,
              ),
            nonStableSlot,
          ),
        }),
      ).render()

      expect(host.innerHTML).toBe('fallback<!--slot-->')

      show.value = true
      await nextTick()

      expect(host.innerHTML).toBe('content<!--if--><!--slot-->')
    })

    test('slot fragment switches local fallback and root v-for content without keeping the inactive anchor in DOM', async () => {
      const items = ref<string[]>([])
      const Child = defineVaporComponent(() =>
        createSlot('default', null, () => document.createTextNode('fallback')),
      )
      const { host } = define(() =>
        createComponent(Child, null, {
          default: extend(
            () =>
              createFor(
                () => items.value,
                item => document.createTextNode(item.value),
                undefined,
                slotRootForFlags,
              ),
            nonStableSlot,
          ),
        }),
      ).render()

      expect(host.innerHTML).toBe('fallback<!--slot-->')

      items.value = ['content']
      await nextTick()

      expect(host.innerHTML).toBe('content<!--for--><!--slot-->')
    })

    test('slot fragment switches root dynamic component content to fallback', async () => {
      const current = shallowRef<any>(() => document.createTextNode('content'))
      const Child = defineVaporComponent(() =>
        createSlot('default', null, () => document.createTextNode('fallback')),
      )
      const { host } = define(() =>
        createComponent(Child, null, {
          default: extend(
            () =>
              createDynamicComponent(
                () => current.value,
                null,
                null,
                VaporDynamicComponentFlags.SINGLE_ROOT |
                  VaporDynamicComponentFlags.SLOT_ROOT,
              ),
            nonStableSlot,
          ),
        }),
      ).render()

      expect(host.innerHTML).toBe('content<!--dynamic-component--><!--slot-->')

      current.value = null
      await nextTick()

      expect(host.innerHTML).toBe('fallback<!--slot-->')
    })

    test('slot fallback falls through and restores local root v-if fallback without keeping inactive anchor in DOM', async () => {
      const container = document.createElement('div')
      const anchor = document.createComment('slot')
      const showLocal = ref(false)
      let state!: SlotFallbackState
      const parentBoundary: SlotBoundaryContext = {
        parent: null,
        getFallback: () => () => document.createTextNode('parent fallback'),
        run: fn => fn(),
        markDirty: vi.fn(),
      }
      const boundary: SlotBoundaryContext = {
        parent: parentBoundary,
        getFallback: () => () =>
          createIf(
            () => showLocal.value,
            () => document.createTextNode('local fallback'),
            undefined,
            keyedSlotRootIfShape,
          ),
        run: fn => fn(),
        markDirty: () => markSlotFallbackDirty(state),
      }
      state = {
        boundary,
        activeFallback: null,
        pendingRecheck: false,
        isRenderingFallback: false,
        getContent: () => [],
        getParentNode: () => container,
        getAnchor: () => anchor,
        isBusy: () => false,
        isDisposed: () => false,
        isContentValid: () => false,
        syncNodes: () => {},
        notifyFallbackValidityChange: vi.fn(),
      }

      container.append(anchor)
      recheckSlotFallback(state)

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
      let state!: SlotFallbackState
      const parentBoundary: SlotBoundaryContext = {
        parent: null,
        getFallback: () => () => document.createTextNode('parent fallback'),
        run: fn => fn(),
        markDirty: vi.fn(),
      }
      const boundary: SlotBoundaryContext = {
        parent: parentBoundary,
        getFallback: () => localFallback,
        run: fn => fn(),
        markDirty: () => markSlotFallbackDirty(state),
      }
      state = {
        boundary,
        activeFallback: null,
        pendingRecheck: false,
        isRenderingFallback: false,
        getContent: () => [],
        getParentNode: () => container,
        getAnchor: () => anchor,
        isBusy: () => false,
        isDisposed: () => false,
        isContentValid: () => false,
        syncNodes: () => {},
        notifyFallbackValidityChange: vi.fn(),
      }

      container.append(anchor)
      recheckSlotFallback(state)
      expect(container.innerHTML).toBe('local fallback<!--slot-->')

      localFallback = undefined
      recheckSlotFallback(state, true)
      expect(container.innerHTML).toBe('parent fallback<!--slot-->')
    })

    test('slot fragment delays fallback activation until pending child validity resolves', () => {
      const container = document.createElement('div')
      const frag = new SlotFragment()
      let child!: VaporFragment

      frag.updateSlot(
        () => {
          child = new VaporFragment([])
          child.validityPending = true
          trackSlotBoundaryDirtying(child)
          return child
        },
        () => document.createTextNode('fallback'),
      )
      insert(frag, container)

      expect(container.innerHTML).toBe('<!--slot-->')

      child.validityPending = false
      child.nodes = []
      child.onUpdated!.forEach(hook => hook())

      expect(container.innerHTML).toBe('fallback<!--slot-->')
    })

    test('slot boundary dirtying ignores non-root v-if updates', async () => {
      const markDirty = vi.fn()
      const show = ref(true)
      const boundary: SlotBoundaryContext = {
        parent: null,
        getFallback: () => undefined,
        run: fn => fn(),
        markDirty,
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
        parent: null,
        getFallback: () => undefined,
        run: fn => fn(),
        markDirty,
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
        parent: null,
        getFallback: () => undefined,
        run: fn => fn(),
        markDirty,
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

    test('slot boundary dirtying tracks root v-for updates', async () => {
      const markDirty = vi.fn()
      const items = ref([1])
      const boundary: SlotBoundaryContext = {
        parent: null,
        getFallback: () => undefined,
        run: fn => fn(),
        markDirty,
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
        parent: null,
        getFallback: () => undefined,
        run: fn => fn(),
        markDirty,
      }
      const Child = defineVaporComponent(() =>
        withSlotBoundary(boundary, () =>
          createSlot('default', null, undefined, VaporSlotFlags.SLOT_ROOT),
        ),
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

    test('slot fallback state ignores dirty notifications after dispose', () => {
      let disposed = false
      const state = createTestSlotFallbackState({
        isDisposed: () => disposed,
      })

      disposed = true
      state.boundary.markDirty()

      expect(state.pendingRecheck).toBe(false)
    })

    test('removed slot fragment ignores queued fallback dirty notifications', () => {
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

    test('withHydratingSlotBoundary isolates fallback-active state between boundaries without local markers', () => {
      const start = document.createComment('[')
      const end = document.createComment(']')
      const host = document.createElement('div')
      host.append(start, end)

      hydrateNode(start, () => {
        withHydratingSlotBoundary(() => {
          const outerEnd = getCurrentSlotEndAnchor()
          expect(outerEnd).toBe(end)

          setCurrentHydrationNode(end)

          withHydratingSlotBoundary(() => {
            expect(getCurrentSlotEndAnchor()).toBe(end)
            expect(isHydratingSlotFallbackActive()).toBe(false)

            withHydratingSlotFallbackActive(() => {
              expect(isHydratingSlotFallbackActive()).toBe(true)

              setCurrentHydrationNode(end)
              withHydratingSlotBoundary(() => {
                expect(getCurrentSlotEndAnchor()).toBe(end)
                expect(isHydratingSlotFallbackActive()).toBe(false)
              })
            })

            expect(getCurrentSlotEndAnchor()).toBe(end)
            expect(isHydratingSlotFallbackActive()).toBe(false)
          })

          expect(getCurrentSlotEndAnchor()).toBe(end)
          expect(isHydratingSlotFallbackActive()).toBe(false)
        })
      })
    })

    test('empty forwarded slot hydration does not clean following sibling', async () => {
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
            frag.forwarded = true
            setCurrentHydrationNode(footer)
            hydrateDynamicFragmentAnchor(frag, true)
          })
        })
      } finally {
        setIsHydratingEnabled(false)
      }
      await nextTick()

      expect(host.innerHTML).toBe(
        '<!--[--><!--]--><!--slot--><footer>footer</footer>',
      )
      expect(frag.anchor).not.toBe(end)
      expect(isHydrationAnchor(end)).toBe(true)
      expect(`Hydration children mismatch`).not.toHaveBeenWarned()
    })

    test('non-forwarded empty slot hydration reuses its close anchor', () => {
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
      expect(isHydrationAnchor(end)).toBe(true)
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
      expect(isHydrationAnchor(end)).toBe(true)
      expect(`Hydration children mismatch`).toHaveBeenWarned()
    })

    test('slot fallback empty inner v-if hydrates before parent close anchor', async () => {
      const start = document.createComment('[')
      const end = document.createComment(']')
      const host = document.createElement('div')
      host.append(start, end)
      let frag!: DynamicFragment

      setIsHydratingEnabled(true)
      try {
        hydrateNode(start, () => {
          withHydratingSlotBoundary(() => {
            withHydratingSlotFallbackActive(() => {
              frag = new DynamicFragment('if', false, false)
              hydrateDynamicFragmentAnchor(frag, true)
            })
          })
        })
      } finally {
        setIsHydratingEnabled(false)
      }
      await nextTick()

      expect(host.innerHTML).toBe('<!--[--><!--if--><!--]-->')
      expect(frag.anchor).toBe(end.previousSibling)
    })

    test('slot fallback state stops fallback scope when fallback body throws', async () => {
      const source = ref(0)
      const effectRuns = vi.fn()
      const cleanup = vi.fn()
      const err = new Error('fallback boom')

      const state = createTestSlotFallbackState({
        fallback: () => {
          onScopeDispose(cleanup)
          renderEffect(() => {
            effectRuns(source.value)
          })
          throw err
        },
      })

      expect(() => recheckSlotFallback(state)).toThrow(err)
      expect(state.activeFallback).toBe(null)
      expect(cleanup).toHaveBeenCalledTimes(1)
      expect(effectRuns).toHaveBeenCalledTimes(1)

      source.value++
      await nextTick()

      expect(effectRuns).toHaveBeenCalledTimes(1)
    })

    test('slot fallback state rechecks when idle', () => {
      const fallback = document.createTextNode('fallback')
      const state = createTestSlotFallbackState({
        fallback: () => fallback,
      })

      state.boundary.markDirty()

      expect(state.activeFallback).toBe(fallback)
    })

    test('vdom slot does not dirty parent boundary when content stays valid', async () => {
      const text = ref('A')
      const boundary = {
        parent: null,
        getFallback: () => undefined,
        run: (fn: () => any) => fn(),
        markDirty: vi.fn(),
      }
      const instance = renderWithSlots({})
      const app = createApp({ render: () => null })
      app.use(vaporInteropPlugin)
      const vapor = (app._context as any).vapor
      const slotsRef = shallowRef({
        default: () => [h('div', text.value)],
      })
      const frag = withSlotBoundary(boundary, () =>
        vapor.vdomSlot(
          slotsRef,
          'default',
          {},
          instance,
          undefined,
          false,
          true,
        ),
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
        parent: null,
        getFallback: () => undefined,
        run: (fn: () => any) => fn(),
        markDirty: vi.fn(),
      }
      const instance = renderWithSlots({})
      const app = createApp({ render: () => null })
      app.use(vaporInteropPlugin)
      const vapor = (app._context as any).vapor
      const slotsRef = shallowRef({
        default: () => [h('div', text.value)],
      })
      const frag = withSlotBoundary(boundary, () =>
        vapor.vdomSlot(slotsRef, 'default', {}, instance),
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
        parent: null,
        getFallback: () => undefined,
        run: (fn: () => any) => fn(),
        markDirty: vi.fn(),
      }
      const instance = renderWithSlots({})
      const app = createApp({ render: () => null })
      app.use(vaporInteropPlugin)
      const vapor = (app._context as any).vapor
      const slotsRef = shallowRef({
        default: () => (show.value ? [h('div', 'content')] : []),
      })
      const frag = withSlotBoundary(boundary, () =>
        vapor.vdomSlot(
          slotsRef,
          'default',
          {},
          instance,
          () => template('fallback')(),
          false,
          true,
        ),
      )
      const host = document.createElement('div')

      insert(frag, host)
      boundary.markDirty.mockClear()

      show.value = false
      await nextTick()

      expect(host.innerHTML).toBe('fallback')
      expect(boundary.markDirty).not.toHaveBeenCalled()
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

    test('vdom slot dirties parent boundary when content validity changes', async () => {
      const show = ref(true)
      const boundary = {
        parent: null,
        getFallback: () => undefined,
        run: (fn: () => any) => fn(),
        markDirty: vi.fn(),
      }
      const instance = renderWithSlots({})
      const app = createApp({ render: () => null })
      app.use(vaporInteropPlugin)
      const vapor = (app._context as any).vapor
      const slotsRef = shallowRef({
        default: () => (show.value ? [h('div', 'content')] : []),
      })
      const frag = withSlotBoundary(boundary, () =>
        vapor.vdomSlot(
          slotsRef,
          'default',
          {},
          instance,
          undefined,
          false,
          true,
        ),
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

    test('vdom slot dirties parent boundary when nested fallback validity flips', async () => {
      const showInnerFallback = ref(true)
      const boundary = {
        parent: null,
        getFallback: () => undefined,
        run: (fn: () => any) => fn(),
        markDirty: vi.fn(),
      }
      const instance = renderWithSlots({})
      const app = createApp({ render: () => null })
      app.use(vaporInteropPlugin)
      const vapor = (app._context as any).vapor
      const slotsRef = shallowRef({
        default: () => [],
      })
      const renderInnerFallback = () => {
        const child = new SlotFragment(true)
        renderEffect(() => {
          child.updateSlot(
            showInnerFallback.value
              ? () => template('inner fallback')()
              : undefined,
          )
        })
        return child
      }
      const frag = withSlotBoundary(boundary, () =>
        vapor.vdomSlot(
          slotsRef,
          'default',
          {},
          instance,
          renderInnerFallback,
          false,
          true,
        ),
      )
      const host = document.createElement('div')

      insert(frag, host)
      boundary.markDirty.mockClear()

      expect(host.innerHTML).toBe('inner fallback<!--slot-->')

      showInnerFallback.value = false
      await nextTick()

      expect(host.innerHTML).toBe('<!--slot-->')
      expect(boundary.markDirty).toHaveBeenCalledTimes(1)

      showInnerFallback.value = true
      await nextTick()

      expect(host.innerHTML).toBe('inner fallback<!--slot-->')
      expect(boundary.markDirty).toHaveBeenCalledTimes(2)
    })

    test('vdom slot still renders vapor fallback when slot content resolves empty', () => {
      const Child = defineVaporComponent({
        setup() {
          return createSlot('default', null, () => template('child fallback')())
        },
      })
      const root = document.createElement('div')

      createApp({
        render: () =>
          h(Child as any, null, {
            default: () => [],
          }),
      })
        .use(vaporInteropPlugin)
        .mount(root)

      expect(root.innerHTML).toBe('child fallback')
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
        prepend(
          n0 as any as ParentNode,
          createSlot('header', { title: () => val.value }),
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
        prepend(
          n0 as any as ParentNode,
          createSlot(
            () => val.value, // dynamic slot outlet name
          ),
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
                () =>
                  createForSlots(slots, (_slot, name) => ({
                    name,
                    fn: () => createSlot(name),
                  })),
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
      expect(html()).toBe('fallback<!--slot-->')

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

      expect(html()).toBe('fallback<!--slot-->')

      toggle.value = true
      await nextTick()
      expect(html()).toBe('content<!--if--><!--slot-->')

      toggle.value = false
      await nextTick()
      expect(html()).toBe('fallback<!--slot-->')
    })

    test('dynamic slot work with v-if', async () => {
      const val = ref('header')
      const toggle = ref(false)

      const Comp = defineVaporComponent(() => {
        const n0 = template('<div></div>')()
        prepend(n0 as any as ParentNode, createSlot('header', null))
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
        prepend(n0 as any as ParentNode, createSlot('header', null))
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

      expect(html()).toBe('fallback<!--slot-->')
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

      expect(html()).toBe('fallback<!--slot-->')

      toggle.value = true
      await nextTick()
      expect(html()).toBe('content<!--if--><!--slot-->')

      toggle.value = false
      await nextTick()
      expect(html()).toBe('fallback<!--slot-->')
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

      expect(html()).toBe('fallback<!--slot-->')

      outerShow.value = true
      await nextTick()
      expect(html()).toBe('fallback<!--slot-->')

      innerShow.value = true
      await nextTick()
      expect(html()).toBe('content<!--if--><!--if--><!--slot-->')

      innerShow.value = false
      await nextTick()
      expect(html()).toBe('fallback<!--slot-->')

      outerShow.value = false
      await nextTick()
      expect(html()).toBe('fallback<!--slot-->')

      outerShow.value = true
      await nextTick()
      expect(html()).toBe('fallback<!--slot-->')

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
      expect(html()).toBe('fallback<!--slot-->')

      items.value.pop()
      await nextTick()
      expect(html()).toBe('fallback<!--slot-->')

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

      expect(html()).toBe('fallback<!--slot-->')

      items.value.push(1)
      await nextTick()
      expect(html()).toBe('<span>1</span><!--for--><!--slot-->')

      items.value.pop()
      await nextTick()
      expect(html()).toBe('fallback<!--slot-->')

      items.value.pop()
      await nextTick()
      expect(html()).toBe('fallback<!--slot-->')

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
      const { html } = define({
        setup() {
          return createComponent(Child, null, {
            default: extend(() => {
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
            }, nonStableSlot),
          })
        },
      }).render()

      expect(html()).toBe('fallback<!--slot-->')

      items.value[0].show = true
      await nextTick()
      expect(html()).toBe('<span>bar</span><!--if--><!--for--><!--slot-->')

      items.value[0].show = false
      await nextTick()
      expect(html()).toBe('fallback<!--slot-->')
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
            return (slotBlock = createSlot(
              'default',
              null,
              undefined,
              VaporSlotFlags.SLOT_ROOT,
            ))
          })

          define(() =>
            createComponent(Comp, null, {
              default: () => {
                observedBoundary = currentSlotBoundary
                return template('content')()
              },
            }),
          ).render()

          expect(slotBlock).toBeInstanceOf(DynamicFragment)
          expect(slotBlock).not.toBeInstanceOf(SlotFragment)
          expect(observedBoundary).toBe(null)
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
          ;(slot as any)._ = VaporSlotFlags.NON_STABLE
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
              const n0 = createSlot('default', null, () => {
                return template('<!-- <div></div> -->')()
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

      expect(html()).toBe('child fallback<!--slot--><!--slot-->')
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
                    setInsertionState(n5, null, 0)
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
              const n0 = createSlot('default', null, () => {
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

      expect(html()).toBe('child fallback<!--slot--><!--slot-->')

      show.value = true
      await nextTick()
      expect(html()).toBe(
        '<div>if content</div><!--if--><!--slot--><!--slot-->',
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
              const n0 = createSlot('default', null, () => {
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

      expect(html()).toBe('child fallback<!--slot--><!--slot-->')

      items.value.push(1)
      await nextTick()
      expect(html()).toBe('<span>1</span><!--for--><!--slot--><!--slot-->')

      items.value.pop()
      await nextTick()
      await nextTick()
      expect(html()).toBe('child fallback<!--slot--><!--slot-->')
    })

    test('consecutive slots with insertion state', async () => {
      const { component: Child } = define({
        setup() {
          const n2 = template('<div><div>baz</div></div>', 1)() as any
          setInsertionState(n2, 0)
          createSlot('default', null)
          setInsertionState(n2, 0)
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
                    ? createSlot('foo', null, () => {
                        const n2 = template(`<div>${fallbackText}</div>`)()
                        return n2
                      })
                    : createSlot('foo', null)
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
                foo: () => createSlot('foo', null),
              },
              true,
            )
          },
        })

        const root = document.createElement('div')
        createVaporApp(VaporForwardedSlot).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<div>fallback</div><!--slot-->')

        useAlt.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<p>alt fallback</p><!--slot-->')
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
                foo: () => createSlot('foo', null),
              },
              true,
            )
          },
        })

        const root = document.createElement('div')
        createVaporApp(VaporForwardedSlot).use(vaporInteropPlugin).mount(root)

        expect(root.innerHTML).toBe('<div>fallback</div><!--slot-->')
        expect(fallbackSpy).toHaveBeenCalledTimes(1)

        fallbackText.value = 'updated fallback'
        await nextTick()

        expect(root.innerHTML).toBe('<div>updated fallback</div><!--slot-->')
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
                foo: () => createSlot('foo', null),
              },
              true,
            )
          },
        })

        const root = document.createElement('div')
        createVaporApp(VaporForwardedSlot).use(vaporInteropPlugin).mount(root)

        expect(root.innerHTML).toBe('fallback<!--slot-->')
        expect(fallbackSpy).toHaveBeenCalledTimes(1)

        fallbackText.value = 'updated fallback'
        await nextTick()

        expect(root.innerHTML).toBe('updated fallback<!--slot-->')
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
                        foo: () => createSlot('foo', null),
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

          expect(targetA.innerHTML).toBe('<div>fallback</div><!--slot-->')
          expect(targetB.innerHTML).toBe('')

          to.value = '#component-slots-fallback-target-b'
          await nextTick()

          expect(targetA.innerHTML).toBe('')
          expect(targetB.innerHTML).toBe('<div>fallback</div><!--slot-->')

          fallbackText.value = 'moved fallback'
          await nextTick()

          expect(targetB.innerHTML).toBe('<div>moved fallback</div><!--slot-->')

          app.unmount()
        } finally {
          targetA.remove()
          targetB.remove()
        }
      })

      test('vdom fallback removal clears inherited vapor fallback', async () => {
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
                foo: () => createSlot('foo', null),
              },
              true,
            )
          },
        })

        const root = document.createElement('div')
        createVaporApp(VaporForwardedSlot).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<div>fallback</div><!--slot-->')

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
                foo: () => createSlot('foo', null),
              },
              true,
            )
          },
        })

        const root = document.createElement('div')
        createVaporApp(VaporForwardedSlot).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<div>fallback</div><!--slot-->')

        showFallback.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<!--slot-->')

        showFallback.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<div>fallback</div><!--slot-->')
      })

      test('vdom fallback removal clears active wrapper fallback for non-slot-fragment content', async () => {
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
        expect(root.innerHTML).toBe('<div>fallback</div>')

        useFallback.value = false
        await nextTick()
        expect(root.innerHTML).toBe('')
      })

      test('vdom fallback toggles between local and inherited fallback for non-slot-fragment content', async () => {
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
        expect(root.innerHTML).toBe('<div>local fallback</div>')

        useFallback.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<div>outer fallback</div>')

        useFallback.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<div>local fallback</div>')
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
        expect(root.innerHTML).toBe('<div>local fallback</div><!--slot-->')
      })

      test('vdom fallback addition activates inherited vapor fallback', async () => {
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
                foo: () => createSlot('foo', null),
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

      test('vdom fallback added over valid forwarded vapor content should activate later when content becomes invalid', async () => {
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
        expect(root.innerHTML).toBe('<div>fallback</div>')
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
                foo: () => createSlot('foo', null),
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

      test('vdom fallback added later should propagate to nested slot boundaries inside still-valid content', async () => {
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
        expect(root.innerHTML).toBe(
          '<span>stable</span><div>outer fallback</div><!--slot-->',
        )
      })

      test('vdom fallback toggles should wait for the next nested invalidation inside still-valid content', async () => {
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
        expect(root.innerHTML).toBe(
          '<span>stable</span><div>outer fallback</div><!--slot-->',
        )
      })

      test('vdom local fallback should expose inherited fallback to nested slot boundaries', async () => {
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
        expect(root.innerHTML).toBe(
          '<span>local stable</span><div>outer fallback</div>',
        )
      })

      test('vdom local fallback should expose inherited fallback to nested interop vapor slot outlets', async () => {
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
        expect(root.textContent).toBe('outer fallback')
      })

      test('vdom local fallback should expose inherited fallback to nested interop vapor forwarded slots', async () => {
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
                bar: () => createSlot('bar', null),
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
        expect(root.textContent).toBe('outer fallback')
      })

      test('vdom local fallback should keep nested inherited vapor fallback reactive after mount', async () => {
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
        expect(root.textContent).toBe('outer fallback')

        fallbackText.value = 'updated outer fallback'
        await nextTick()

        expect(root.textContent).toBe('updated outer fallback')
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
                bar: () => createSlot('bar', null),
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
                foo: () => createSlot('foo', null),
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
                bar: () => createSlot('bar', null),
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
                foo: () => createSlot('foo', null),
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
                  () =>
                    createForSlots(values.value, value => ({
                      name: 'default',
                      fn: () => {
                        if (value === 1) {
                          throw new Error('slot boom')
                        }
                        return template('<span>ok</span>')()
                      },
                    })),
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
        expect(root.innerHTML).toBe('<div>fallback</div><!--slot--><!--slot-->')

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
          '<div>vdom fallback</div><!--slot--><!--slot-->',
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
        expect(root.innerHTML).toBe('<div>fallback</div><!--slot-->')

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
        expect(root.innerHTML).toBe('<div>fallback</div><!--slot--><!--slot-->')

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
              () =>
                createForSlots(loop.value, (item, i) => ({
                  name: item,
                  fn: () => template(item + i)(),
                })),
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
              () =>
                createForSlots(getItems(), (item, i) => ({
                  name: 'slot' + item,
                  fn: () => template(String(item))(),
                })),
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
              () =>
                createForSlots(getItems(), (item, i) => ({
                  name: 'slot' + item,
                  fn: () => template(String(item))(),
                })),
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
              () =>
                createForSlots(items.value, item => ({
                  name: 'slot' + item,
                  fn: () => template('content' + item)(),
                })),
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
              () =>
                createForSlots(list.value, item => ({
                  name: 'default',
                  fn: () => template(String(item))(),
                })),
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
              () =>
                createForSlots(loop.value as any, (item, i) => ({
                  name: item,
                  fn: () => template(item + i)(),
                })),
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
  })
})
