import {
  BaseTransition,
  type Component,
  type ComponentOptions,
  type ComponentPublicInstance,
  type EffectScope,
  KeepAlive,
  type Ref,
  Suspense,
  Teleport,
  type TestElement,
  type VNode,
  cloneVNode,
  createApp,
  createVNode,
  defineAsyncComponent,
  defineComponent,
  effect,
  effectScope,
  getCurrentScope,
  h,
  inject,
  markRaw,
  nextTick,
  nodeOps,
  onActivated,
  onDeactivated,
  onMounted,
  onUnmounted,
  provide,
  reactive,
  ref,
  render,
  serializeInner,
  shallowRef,
  watch,
  watchEffect,
} from '@vue/runtime-test'
import type { KeepAliveProps } from '../../src/components/KeepAlive'
import { PatchFlags } from '@vue/shared'

const timeout = (n: number = 0) => new Promise(r => setTimeout(r, n))

describe('KeepAlive', () => {
  let one: ComponentOptions
  let two: ComponentOptions
  let oneTest: ComponentOptions
  let views: Record<string, ComponentOptions>
  let root: TestElement

  beforeEach(() => {
    root = nodeOps.createElement('div')
    one = {
      name: 'one',
      data: () => ({ msg: 'one' }),
      render(this: any) {
        return h('div', this.msg)
      },
      created: vi.fn(),
      mounted: vi.fn(),
      activated: vi.fn(),
      deactivated: vi.fn(),
      unmounted: vi.fn(),
    }
    oneTest = {
      name: 'oneTest',
      data: () => ({ msg: 'oneTest' }),
      render(this: any) {
        return h('div', this.msg)
      },
      created: vi.fn(),
      mounted: vi.fn(),
      activated: vi.fn(),
      deactivated: vi.fn(),
      unmounted: vi.fn(),
    }
    two = {
      name: 'two',
      data: () => ({ msg: 'two' }),
      render(this: any) {
        return h('div', this.msg)
      },
      created: vi.fn(),
      mounted: vi.fn(),
      activated: vi.fn(),
      deactivated: vi.fn(),
      unmounted: vi.fn(),
    }
    views = {
      one,
      oneTest,
      two,
    }
  })

  function assertHookCalls(component: any, callCounts: number[]) {
    expect([
      component.created.mock.calls.length,
      component.mounted.mock.calls.length,
      component.activated.mock.calls.length,
      component.deactivated.mock.calls.length,
      component.unmounted.mock.calls.length,
    ]).toEqual(callCounts)
  }

  test('should preserve state', async () => {
    const viewRef = ref('one')
    const instanceRef = ref<any>(null)
    const App = {
      render() {
        return h(KeepAlive, null, {
          default: () => h(views[viewRef.value], { ref: instanceRef }),
        })
      },
    }
    render(h(App), root)
    expect(serializeInner(root)).toBe(`<div>one</div>`)
    instanceRef.value.msg = 'changed'
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>changed</div>`)
    viewRef.value = 'two'
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>two</div>`)
    viewRef.value = 'one'
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>changed</div>`)
  })

  test('should call correct lifecycle hooks', async () => {
    const toggle = ref(true)
    const viewRef = ref('one')
    const App = {
      render() {
        return toggle.value ? h(KeepAlive, () => h(views[viewRef.value])) : null
      },
    }
    render(h(App), root)

    expect(serializeInner(root)).toBe(`<div>one</div>`)
    assertHookCalls(one, [1, 1, 1, 0, 0])
    assertHookCalls(two, [0, 0, 0, 0, 0])

    // toggle kept-alive component
    viewRef.value = 'two'
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>two</div>`)
    assertHookCalls(one, [1, 1, 1, 1, 0])
    assertHookCalls(two, [1, 1, 1, 0, 0])

    viewRef.value = 'one'
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>one</div>`)
    assertHookCalls(one, [1, 1, 2, 1, 0])
    assertHookCalls(two, [1, 1, 1, 1, 0])

    viewRef.value = 'two'
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>two</div>`)
    assertHookCalls(one, [1, 1, 2, 2, 0])
    assertHookCalls(two, [1, 1, 2, 1, 0])

    // teardown keep-alive, should unmount all components including cached
    toggle.value = false
    await nextTick()
    expect(serializeInner(root)).toBe(`<!---->`)
    assertHookCalls(one, [1, 1, 2, 2, 1])
    assertHookCalls(two, [1, 1, 2, 2, 1])
  })

  test('should call correct lifecycle hooks when toggle the KeepAlive first', async () => {
    const toggle = ref(true)
    const viewRef = ref('one')
    const App = {
      render() {
        return toggle.value ? h(KeepAlive, () => h(views[viewRef.value])) : null
      },
    }
    render(h(App), root)

    expect(serializeInner(root)).toBe(`<div>one</div>`)
    assertHookCalls(one, [1, 1, 1, 0, 0])
    assertHookCalls(two, [0, 0, 0, 0, 0])

    // should unmount 'one' component when toggle the KeepAlive first
    toggle.value = false
    await nextTick()
    expect(serializeInner(root)).toBe(`<!---->`)
    assertHookCalls(one, [1, 1, 1, 1, 1])
    assertHookCalls(two, [0, 0, 0, 0, 0])

    toggle.value = true
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>one</div>`)
    assertHookCalls(one, [2, 2, 2, 1, 1])
    assertHookCalls(two, [0, 0, 0, 0, 0])

    // 1. the first time toggle kept-alive component
    viewRef.value = 'two'
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>two</div>`)
    assertHookCalls(one, [2, 2, 2, 2, 1])
    assertHookCalls(two, [1, 1, 1, 0, 0])

    // 2. should unmount all components including cached
    toggle.value = false
    await nextTick()
    expect(serializeInner(root)).toBe(`<!---->`)
    assertHookCalls(one, [2, 2, 2, 2, 2])
    assertHookCalls(two, [1, 1, 1, 1, 1])
  })

  test('should call lifecycle hooks on nested components', async () => {
    one.render = () => h(two)

    const toggle = ref(true)
    const App = {
      render() {
        return h(KeepAlive, () => (toggle.value ? h(one) : null))
      },
    }
    render(h(App), root)

    expect(serializeInner(root)).toBe(`<div>two</div>`)
    assertHookCalls(one, [1, 1, 1, 0, 0])
    assertHookCalls(two, [1, 1, 1, 0, 0])

    toggle.value = false
    await nextTick()
    expect(serializeInner(root)).toBe(`<!---->`)
    assertHookCalls(one, [1, 1, 1, 1, 0])
    assertHookCalls(two, [1, 1, 1, 1, 0])

    toggle.value = true
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>two</div>`)
    assertHookCalls(one, [1, 1, 2, 1, 0])
    assertHookCalls(two, [1, 1, 2, 1, 0])

    toggle.value = false
    await nextTick()
    expect(serializeInner(root)).toBe(`<!---->`)
    assertHookCalls(one, [1, 1, 2, 2, 0])
    assertHookCalls(two, [1, 1, 2, 2, 0])
  })

  // #1742
  test('should call lifecycle hooks on nested components when root component no hooks', async () => {
    const two = {
      name: 'two',
      data: () => ({ msg: 'two' }),
      render(this: any) {
        return h('div', this.msg)
      },
      activated: vi.fn(),
    }
    const one = {
      name: 'one',
      data: () => ({ msg: 'one' }),
      render(this: any) {
        return h(two)
      },
    }

    const toggle = ref(true)
    const App = {
      render() {
        return h(KeepAlive, () => (toggle.value ? h(one) : null))
      },
    }
    render(h(App), root)

    expect(serializeInner(root)).toBe(`<div>two</div>`)
    expect(two.activated).toHaveBeenCalledTimes(1)
  })

  test('should call correct hooks for nested keep-alive', async () => {
    const toggle2 = ref(true)
    one.render = () => h(KeepAlive, () => (toggle2.value ? h(two) : null))

    const toggle1 = ref(true)
    const App = {
      render() {
        return h(KeepAlive, () => (toggle1.value ? h(one) : null))
      },
    }
    render(h(App), root)

    expect(serializeInner(root)).toBe(`<div>two</div>`)
    assertHookCalls(one, [1, 1, 1, 0, 0])
    assertHookCalls(two, [1, 1, 1, 0, 0])

    toggle1.value = false
    await nextTick()
    expect(serializeInner(root)).toBe(`<!---->`)
    assertHookCalls(one, [1, 1, 1, 1, 0])
    assertHookCalls(two, [1, 1, 1, 1, 0])

    toggle1.value = true
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>two</div>`)
    assertHookCalls(one, [1, 1, 2, 1, 0])
    assertHookCalls(two, [1, 1, 2, 1, 0])

    // toggle nested instance
    toggle2.value = false
    await nextTick()
    expect(serializeInner(root)).toBe(`<!---->`)
    assertHookCalls(one, [1, 1, 2, 1, 0])
    assertHookCalls(two, [1, 1, 2, 2, 0])

    toggle2.value = true
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>two</div>`)
    assertHookCalls(one, [1, 1, 2, 1, 0])
    assertHookCalls(two, [1, 1, 3, 2, 0])

    toggle1.value = false
    await nextTick()
    expect(serializeInner(root)).toBe(`<!---->`)
    assertHookCalls(one, [1, 1, 2, 2, 0])
    assertHookCalls(two, [1, 1, 3, 3, 0])

    // toggle nested instance when parent is deactivated
    toggle2.value = false
    await nextTick()
    expect(serializeInner(root)).toBe(`<!---->`)
    assertHookCalls(one, [1, 1, 2, 2, 0])
    assertHookCalls(two, [1, 1, 3, 3, 0]) // should not be affected

    toggle2.value = true
    await nextTick()
    expect(serializeInner(root)).toBe(`<!---->`)
    assertHookCalls(one, [1, 1, 2, 2, 0])
    assertHookCalls(two, [1, 1, 3, 3, 0]) // should not be affected

    toggle1.value = true
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>two</div>`)
    assertHookCalls(one, [1, 1, 3, 2, 0])
    assertHookCalls(two, [1, 1, 4, 3, 0])

    toggle1.value = false
    toggle2.value = false
    await nextTick()
    expect(serializeInner(root)).toBe(`<!---->`)
    assertHookCalls(one, [1, 1, 3, 3, 0])
    assertHookCalls(two, [1, 1, 4, 4, 0])

    toggle1.value = true
    await nextTick()
    expect(serializeInner(root)).toBe(`<!---->`)
    assertHookCalls(one, [1, 1, 4, 3, 0])
    assertHookCalls(two, [1, 1, 4, 4, 0]) // should remain inactive
  })

  async function assertNameMatch(props: KeepAliveProps) {
    const outerRef = ref(true)
    const viewRef = ref('one')
    const App = {
      render() {
        return outerRef.value
          ? h(KeepAlive, props, () => h(views[viewRef.value]))
          : null
      },
    }
    render(h(App), root)

    expect(serializeInner(root)).toBe(`<div>one</div>`)
    assertHookCalls(one, [1, 1, 1, 0, 0])
    assertHookCalls(two, [0, 0, 0, 0, 0])

    viewRef.value = 'two'
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>two</div>`)
    assertHookCalls(one, [1, 1, 1, 1, 0])
    assertHookCalls(two, [1, 1, 0, 0, 0])

    viewRef.value = 'one'
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>one</div>`)
    assertHookCalls(one, [1, 1, 2, 1, 0])
    assertHookCalls(two, [1, 1, 0, 0, 1])

    viewRef.value = 'two'
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>two</div>`)
    assertHookCalls(one, [1, 1, 2, 2, 0])
    assertHookCalls(two, [2, 2, 0, 0, 1])

    // teardown
    outerRef.value = false
    await nextTick()
    expect(serializeInner(root)).toBe(`<!---->`)
    assertHookCalls(one, [1, 1, 2, 2, 1])
    assertHookCalls(two, [2, 2, 0, 0, 2])
  }

  async function assertNameMatchWithFlag(props: KeepAliveProps) {
    const outerRef = ref(true)
    const viewRef = ref('one')
    const App = {
      render() {
        return outerRef.value
          ? h(KeepAlive, props, () => h(views[viewRef.value]))
          : null
      },
    }
    render(h(App), root)

    expect(serializeInner(root)).toBe(`<div>one</div>`)
    assertHookCalls(one, [1, 1, 1, 0, 0])
    assertHookCalls(oneTest, [0, 0, 0, 0, 0])
    assertHookCalls(two, [0, 0, 0, 0, 0])

    viewRef.value = 'oneTest'
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>oneTest</div>`)
    assertHookCalls(one, [1, 1, 1, 1, 0])
    assertHookCalls(oneTest, [1, 1, 1, 0, 0])
    assertHookCalls(two, [0, 0, 0, 0, 0])

    viewRef.value = 'two'
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>two</div>`)
    assertHookCalls(one, [1, 1, 1, 1, 0])
    assertHookCalls(oneTest, [1, 1, 1, 1, 0])
    assertHookCalls(two, [1, 1, 0, 0, 0])

    viewRef.value = 'one'
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>one</div>`)
    assertHookCalls(one, [1, 1, 2, 1, 0])
    assertHookCalls(oneTest, [1, 1, 1, 1, 0])
    assertHookCalls(two, [1, 1, 0, 0, 1])

    viewRef.value = 'oneTest'
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>oneTest</div>`)
    assertHookCalls(one, [1, 1, 2, 2, 0])
    assertHookCalls(oneTest, [1, 1, 2, 1, 0])
    assertHookCalls(two, [1, 1, 0, 0, 1])

    viewRef.value = 'two'
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>two</div>`)
    assertHookCalls(one, [1, 1, 2, 2, 0])
    assertHookCalls(oneTest, [1, 1, 2, 2, 0])
    assertHookCalls(two, [2, 2, 0, 0, 1])

    // teardown
    outerRef.value = false
    await nextTick()
    expect(serializeInner(root)).toBe(`<!---->`)
    assertHookCalls(one, [1, 1, 2, 2, 1])
    assertHookCalls(oneTest, [1, 1, 2, 2, 1])
    assertHookCalls(two, [2, 2, 0, 0, 2])
  }

  async function assertNameMatchWithFlagExclude(props: KeepAliveProps) {
    const outerRef = ref(true)
    const viewRef = ref('one')
    const App = {
      render() {
        return outerRef.value
          ? h(KeepAlive, props, () => h(views[viewRef.value]))
          : null
      },
    }
    render(h(App), root)

    expect(serializeInner(root)).toBe(`<div>one</div>`)
    assertHookCalls(one, [1, 1, 0, 0, 0])
    assertHookCalls(oneTest, [0, 0, 0, 0, 0])
    assertHookCalls(two, [0, 0, 0, 0, 0])

    viewRef.value = 'oneTest'
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>oneTest</div>`)
    assertHookCalls(one, [1, 1, 0, 0, 1])
    assertHookCalls(oneTest, [1, 1, 0, 0, 0])
    assertHookCalls(two, [0, 0, 0, 0, 0])

    viewRef.value = 'two'
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>two</div>`)
    assertHookCalls(one, [1, 1, 0, 0, 1])
    assertHookCalls(oneTest, [1, 1, 0, 0, 1])
    assertHookCalls(two, [1, 1, 1, 0, 0])

    viewRef.value = 'one'
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>one</div>`)
    assertHookCalls(one, [2, 2, 0, 0, 1])
    assertHookCalls(oneTest, [1, 1, 0, 0, 1])
    assertHookCalls(two, [1, 1, 1, 1, 0])

    viewRef.value = 'oneTest'
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>oneTest</div>`)
    assertHookCalls(one, [2, 2, 0, 0, 2])
    assertHookCalls(oneTest, [2, 2, 0, 0, 1])
    assertHookCalls(two, [1, 1, 1, 1, 0])

    viewRef.value = 'two'
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>two</div>`)
    assertHookCalls(one, [2, 2, 0, 0, 2])
    assertHookCalls(oneTest, [2, 2, 0, 0, 2])
    assertHookCalls(two, [1, 1, 2, 1, 0])

    // teardown
    outerRef.value = false
    await nextTick()
    expect(serializeInner(root)).toBe(`<!---->`)
    assertHookCalls(one, [2, 2, 0, 0, 2])
    assertHookCalls(oneTest, [2, 2, 0, 0, 2])
    assertHookCalls(two, [1, 1, 2, 2, 1])
  }

  describe('props', () => {
    test('include (string)', async () => {
      await assertNameMatch({ include: 'one' })
    })

    test('include (regex)', async () => {
      await assertNameMatch({ include: /^one$/ })
    })

    test('include (regex with g flag)', async () => {
      await assertNameMatchWithFlag({ include: /one/g })
    })

    test('include (array)', async () => {
      await assertNameMatch({ include: ['one'] })
    })

    test('exclude (string)', async () => {
      await assertNameMatch({ exclude: 'two' })
    })

    test('exclude (regex)', async () => {
      await assertNameMatch({ exclude: /^two$/ })
    })

    test('exclude (regex with a flag)', async () => {
      await assertNameMatchWithFlagExclude({ exclude: /one/g })
    })

    test('exclude (array)', async () => {
      await assertNameMatch({ exclude: ['two'] })
    })

    test('include + exclude', async () => {
      await assertNameMatch({ include: 'one,two', exclude: 'two' })
    })

    test('max', async () => {
      const spyAC = vi.fn()
      const spyBC = vi.fn()
      const spyCC = vi.fn()
      const spyAA = vi.fn()
      const spyBA = vi.fn()
      const spyCA = vi.fn()
      const spyADA = vi.fn()
      const spyBDA = vi.fn()
      const spyCDA = vi.fn()
      const spyAUM = vi.fn()
      const spyBUM = vi.fn()
      const spyCUM = vi.fn()

      function assertCount(calls: number[]) {
        expect([
          spyAC.mock.calls.length,
          spyAA.mock.calls.length,
          spyADA.mock.calls.length,
          spyAUM.mock.calls.length,
          spyBC.mock.calls.length,
          spyBA.mock.calls.length,
          spyBDA.mock.calls.length,
          spyBUM.mock.calls.length,
          spyCC.mock.calls.length,
          spyCA.mock.calls.length,
          spyCDA.mock.calls.length,
          spyCUM.mock.calls.length,
        ]).toEqual(calls)
      }

      const viewRef = ref('a')
      const views: Record<string, ComponentOptions> = {
        a: {
          render: () => `one`,
          created: spyAC,
          activated: spyAA,
          deactivated: spyADA,
          unmounted: spyAUM,
        },
        b: {
          render: () => `two`,
          created: spyBC,
          activated: spyBA,
          deactivated: spyBDA,
          unmounted: spyBUM,
        },
        c: {
          render: () => `three`,
          created: spyCC,
          activated: spyCA,
          deactivated: spyCDA,
          unmounted: spyCUM,
        },
      }

      const App = {
        render() {
          return h(KeepAlive, { max: 2 }, () => {
            return h(views[viewRef.value])
          })
        },
      }
      render(h(App), root)
      assertCount([1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])

      viewRef.value = 'b'
      await nextTick()
      assertCount([1, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0])

      viewRef.value = 'c'
      await nextTick()
      // should prune A because max cache reached
      assertCount([1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 0])

      viewRef.value = 'b'
      await nextTick()
      // B should be reused, and made latest
      assertCount([1, 1, 1, 1, 1, 2, 1, 0, 1, 1, 1, 0])

      viewRef.value = 'a'
      await nextTick()
      // C should be pruned because B was used last so C is the oldest cached
      assertCount([2, 2, 1, 1, 1, 2, 2, 0, 1, 1, 1, 1])
    })

    // #15710
    test('max should unmount pruned current component when reusing mounted vnode', async () => {
      const viewRef = ref('one')
      const reuse = ref(false)
      let prev: any
      const App = {
        render() {
          if (reuse.value && prev) return prev
          return (prev = h(KeepAlive, { max: 1 }, () =>
            h(views[viewRef.value]),
          ))
        },
      }
      render(h(App), root)
      expect(serializeInner(root)).toBe(`<div>one</div>`)

      reuse.value = true
      await nextTick()
      expect(serializeInner(root)).toBe(`<div>one</div>`)

      reuse.value = false
      viewRef.value = 'two'
      await nextTick()
      expect(serializeInner(root)).toBe(`<div>two</div>`)
      expect(one.deactivated).not.toHaveBeenCalled()
      expect(one.unmounted).toHaveBeenCalledTimes(1)
    })
  })

  describe('cache invalidation', () => {
    function setup() {
      const viewRef = ref('one')
      const includeRef = ref('one,two')
      const App = {
        render() {
          return h(
            KeepAlive,
            {
              include: includeRef.value,
            },
            () => h(views[viewRef.value]),
          )
        },
      }
      render(h(App), root)
      return { viewRef, includeRef }
    }

    function setupExclude() {
      const viewRef = ref('one')
      const excludeRef = ref('')
      const App = {
        render() {
          return h(
            KeepAlive,
            {
              exclude: excludeRef.value,
            },
            () => h(views[viewRef.value]),
          )
        },
      }
      render(h(App), root)
      return { viewRef, excludeRef }
    }

    test('on include change', async () => {
      const { viewRef, includeRef } = setup()

      viewRef.value = 'two'
      await nextTick()
      assertHookCalls(one, [1, 1, 1, 1, 0])
      assertHookCalls(two, [1, 1, 1, 0, 0])

      includeRef.value = 'two'
      await nextTick()
      assertHookCalls(one, [1, 1, 1, 1, 1])
      assertHookCalls(two, [1, 1, 1, 0, 0])

      viewRef.value = 'one'
      await nextTick()
      assertHookCalls(one, [2, 2, 1, 1, 1])
      assertHookCalls(two, [1, 1, 1, 1, 0])
    })

    test('on exclude change', async () => {
      const { viewRef, excludeRef } = setupExclude()

      viewRef.value = 'two'
      await nextTick()
      assertHookCalls(one, [1, 1, 1, 1, 0])
      assertHookCalls(two, [1, 1, 1, 0, 0])

      excludeRef.value = 'one'
      await nextTick()
      assertHookCalls(one, [1, 1, 1, 1, 1])
      assertHookCalls(two, [1, 1, 1, 0, 0])

      viewRef.value = 'one'
      await nextTick()
      assertHookCalls(one, [2, 2, 1, 1, 1])
      assertHookCalls(two, [1, 1, 1, 1, 0])
    })

    test('on include change + view switch', async () => {
      const { viewRef, includeRef } = setup()

      viewRef.value = 'two'
      await nextTick()
      assertHookCalls(one, [1, 1, 1, 1, 0])
      assertHookCalls(two, [1, 1, 1, 0, 0])

      includeRef.value = 'one'
      viewRef.value = 'one'
      await nextTick()
      assertHookCalls(one, [1, 1, 2, 1, 0])
      // two should be pruned
      assertHookCalls(two, [1, 1, 1, 1, 1])
    })

    test('on exclude change + view switch', async () => {
      const { viewRef, excludeRef } = setupExclude()

      viewRef.value = 'two'
      await nextTick()
      assertHookCalls(one, [1, 1, 1, 1, 0])
      assertHookCalls(two, [1, 1, 1, 0, 0])

      excludeRef.value = 'two'
      viewRef.value = 'one'
      await nextTick()
      assertHookCalls(one, [1, 1, 2, 1, 0])
      // two should be pruned
      assertHookCalls(two, [1, 1, 1, 1, 1])
    })

    test('should not prune current active instance', async () => {
      const { viewRef, includeRef } = setup()

      includeRef.value = 'two'
      await nextTick()
      assertHookCalls(one, [1, 1, 1, 0, 0])
      assertHookCalls(two, [0, 0, 0, 0, 0])

      viewRef.value = 'two'
      await nextTick()
      assertHookCalls(one, [1, 1, 1, 0, 1])
      assertHookCalls(two, [1, 1, 1, 0, 0])
    })

    async function assertAnonymous(include: boolean) {
      const one = {
        name: 'one',
        created: vi.fn(),
        render: () => 'one',
      }

      const two = {
        // anonymous
        created: vi.fn(),
        render: () => 'two',
      }

      const views: any = { one, two }
      const viewRef = ref('one')

      const App = {
        render() {
          return h(
            KeepAlive,
            {
              include: include ? 'one' : undefined,
            },
            () => h(views[viewRef.value]),
          )
        },
      }
      render(h(App), root)

      function assert(oneCreateCount: number, twoCreateCount: number) {
        expect(one.created.mock.calls.length).toBe(oneCreateCount)
        expect(two.created.mock.calls.length).toBe(twoCreateCount)
      }

      assert(1, 0)

      viewRef.value = 'two'
      await nextTick()
      assert(1, 1)

      viewRef.value = 'one'
      await nextTick()
      assert(1, 1)

      viewRef.value = 'two'
      await nextTick()
      // two should be re-created if include is specified, since it's not matched
      // otherwise it should be cached.
      assert(1, include ? 2 : 1)
    }

    // 2.x #6938
    test('should not cache anonymous component when include is specified', async () => {
      await assertAnonymous(true)
    })

    test('should cache anonymous components if include is not specified', async () => {
      await assertAnonymous(false)
    })

    // 2.x #7105
    test('should not destroy active instance when pruning cache', async () => {
      const Foo = {
        render: () => 'foo',
        unmounted: vi.fn(),
      }
      const includeRef = ref(['foo'])
      const App = {
        render() {
          return h(
            KeepAlive,
            {
              include: includeRef.value,
            },
            () => h(Foo),
          )
        },
      }
      render(h(App), root)
      // condition: a render where a previous component is reused
      includeRef.value = ['foo', 'bar']
      await nextTick()
      includeRef.value = []
      await nextTick()
      expect(Foo.unmounted).not.toHaveBeenCalled()
    })

    test('should update re-activated component if props have changed', async () => {
      const Foo = (props: { n: number }) => props.n

      const toggle = ref(true)
      const n = ref(0)

      const App = {
        setup() {
          return () =>
            h(KeepAlive, () => (toggle.value ? h(Foo, { n: n.value }) : null))
        },
      }

      render(h(App), root)
      expect(serializeInner(root)).toBe(`0`)

      toggle.value = false
      await nextTick()
      expect(serializeInner(root)).toBe(`<!---->`)

      n.value++
      await nextTick()
      toggle.value = true
      await nextTick()
      expect(serializeInner(root)).toBe(`1`)
    })
  })

  it('should call correct vnode hooks', async () => {
    const Foo = markRaw({
      name: 'Foo',
      render() {
        return h('Foo')
      },
    })
    const Bar = markRaw({
      name: 'Bar',
      render() {
        return h('Bar')
      },
    })

    const spyMounted = vi.fn()
    const spyUnmounted = vi.fn()

    const RouterView = defineComponent({
      setup(_, { slots }) {
        const Component = inject<Ref<ComponentPublicInstance>>('component')
        const refView = ref()

        let componentProps = {
          ref: refView,
          onVnodeMounted() {
            spyMounted()
          },
          onVnodeUnmounted() {
            spyUnmounted()
          },
        }

        return () => {
          const child: any = slots.default!({
            Component: Component!.value,
          })[0]

          const innerChild = child.children[0]
          child.children[0] = cloneVNode(innerChild, componentProps)
          return child
        }
      },
    })

    let toggle: () => void = () => {}

    const App = defineComponent({
      setup() {
        const component = ref(Foo)

        provide('component', component)

        toggle = () => {
          component.value = component.value === Foo ? Bar : Foo
        }
        return {
          component,
          toggle,
        }
      },
      render() {
        return h(RouterView, null, {
          default: ({ Component }: any) => h(KeepAlive, null, [h(Component)]),
        })
      },
    })

    render(h(App), root)
    await nextTick()
    expect(spyMounted).toHaveBeenCalledTimes(1)
    expect(spyUnmounted).toHaveBeenCalledTimes(0)

    toggle()
    await nextTick()

    expect(spyMounted).toHaveBeenCalledTimes(2)
    expect(spyUnmounted).toHaveBeenCalledTimes(1)

    toggle()
    await nextTick()
    expect(spyMounted).toHaveBeenCalledTimes(3)
    expect(spyUnmounted).toHaveBeenCalledTimes(2)

    render(null, root)
    await nextTick()
    expect(spyMounted).toHaveBeenCalledTimes(3)
    expect(spyUnmounted).toHaveBeenCalledTimes(4)
  })

  // #1511
  test('should work with cloned root due to scopeId / fallthrough attrs', async () => {
    const viewRef = ref('one')
    const instanceRef = ref<any>(null)
    const App = {
      __scopeId: 'foo',
      render: () => {
        return h(KeepAlive, null, {
          default: () => h(views[viewRef.value], { ref: instanceRef }),
        })
      },
    }
    render(h(App), root)
    expect(serializeInner(root)).toBe(`<div foo>one</div>`)
    instanceRef.value.msg = 'changed'
    await nextTick()
    expect(serializeInner(root)).toBe(`<div foo>changed</div>`)
    viewRef.value = 'two'
    await nextTick()
    expect(serializeInner(root)).toBe(`<div foo>two</div>`)
    viewRef.value = 'one'
    await nextTick()
    expect(serializeInner(root)).toBe(`<div foo>changed</div>`)
  })

  test('should work with async component', async () => {
    let resolve: (comp: Component) => void
    const AsyncComp = defineAsyncComponent(
      () =>
        new Promise(r => {
          resolve = r as any
        }),
    )

    const toggle = ref(true)
    const instanceRef = ref<any>(null)
    const App = {
      render: () => {
        return h(KeepAlive, { include: 'Foo' }, () =>
          toggle.value ? h(AsyncComp, { ref: instanceRef }) : null,
        )
      },
    }

    render(h(App), root)
    // async component has not been resolved
    expect(serializeInner(root)).toBe('<!---->')

    resolve!({
      name: 'Foo',
      data: () => ({ count: 0 }),
      render() {
        return h('p', this.count)
      },
    })

    await timeout()
    // resolved
    expect(serializeInner(root)).toBe('<p>0</p>')

    // change state + toggle out
    instanceRef.value.count++
    toggle.value = false
    await nextTick()
    expect(serializeInner(root)).toBe('<!---->')

    // toggle in, state should be maintained
    toggle.value = true
    await nextTick()
    expect(serializeInner(root)).toBe('<p>1</p>')
  })

  // #4976
  test('handle error in async onActivated', async () => {
    const err = new Error('foo')
    const handler = vi.fn()

    const app = createApp({
      setup() {
        return () => h(KeepAlive, null, () => h(Child))
      },
    })

    const Child = {
      setup() {
        onActivated(async () => {
          throw err
        })
      },
      render() {},
    }

    app.config.errorHandler = handler
    app.mount(nodeOps.createElement('div'))

    await nextTick()
    expect(handler).toHaveBeenCalledWith(err, {}, 'activated hook')
  })

  // #3648
  test('should avoid unmount later included components', async () => {
    const unmountedA = vi.fn()
    const mountedA = vi.fn()
    const activatedA = vi.fn()
    const deactivatedA = vi.fn()
    const unmountedB = vi.fn()
    const mountedB = vi.fn()

    const A = {
      name: 'A',
      setup() {
        onMounted(mountedA)
        onUnmounted(unmountedA)
        onActivated(activatedA)
        onDeactivated(deactivatedA)
        return () => 'A'
      },
    }
    const B = {
      name: 'B',
      setup() {
        onMounted(mountedB)
        onUnmounted(unmountedB)
        return () => 'B'
      },
    }

    const include = reactive<string[]>([])
    const current = shallowRef(A)
    const app = createApp({
      setup() {
        return () => {
          return [
            h(
              KeepAlive,
              {
                include,
              },
              h(current.value),
            ),
          ]
        }
      },
    })

    app.mount(root)

    expect(serializeInner(root)).toBe(`A`)
    expect(mountedA).toHaveBeenCalledTimes(1)
    expect(unmountedA).toHaveBeenCalledTimes(0)
    expect(activatedA).toHaveBeenCalledTimes(0)
    expect(deactivatedA).toHaveBeenCalledTimes(0)
    expect(mountedB).toHaveBeenCalledTimes(0)
    expect(unmountedB).toHaveBeenCalledTimes(0)

    include.push('A') // cache A
    await nextTick()
    current.value = B // toggle to B
    await nextTick()
    expect(serializeInner(root)).toBe(`B`)
    expect(mountedA).toHaveBeenCalledTimes(1)
    expect(unmountedA).toHaveBeenCalledTimes(0)
    expect(activatedA).toHaveBeenCalledTimes(0)
    expect(deactivatedA).toHaveBeenCalledTimes(1)
    expect(mountedB).toHaveBeenCalledTimes(1)
    expect(unmountedB).toHaveBeenCalledTimes(0)
  })

  // #11717
  test('remove component from include then switching child', async () => {
    const About = {
      name: 'About',
      render() {
        return h('h1', 'About')
      },
    }
    const mountedHome = vi.fn()
    const unmountedHome = vi.fn()
    const activatedHome = vi.fn()
    const deactivatedHome = vi.fn()
    const Home = {
      name: 'Home',
      setup() {
        onMounted(mountedHome)
        onUnmounted(unmountedHome)
        onDeactivated(deactivatedHome)
        onActivated(activatedHome)
        return () => {
          h('h1', 'Home')
        }
      },
    }
    const activeViewName = ref('Home')
    const cacheList = reactive(['Home'])
    const App = createApp({
      setup() {
        return () => {
          return [
            h(
              KeepAlive,
              {
                include: cacheList,
              },
              [activeViewName.value === 'Home' ? h(Home) : h(About)],
            ),
          ]
        }
      },
    })
    App.mount(nodeOps.createElement('div'))
    expect(mountedHome).toHaveBeenCalledTimes(1)
    expect(activatedHome).toHaveBeenCalledTimes(1)
    cacheList.splice(0, 1)
    await nextTick()
    activeViewName.value = 'About'
    await nextTick()
    expect(deactivatedHome).toHaveBeenCalledTimes(0)
    expect(unmountedHome).toHaveBeenCalledTimes(1)
  })

  test('should work with async component when update `include` props', async () => {
    let resolve: (comp: Component) => void
    const AsyncComp = defineAsyncComponent(
      () =>
        new Promise(r => {
          resolve = r as any
        }),
    )

    const toggle = ref(true)
    const instanceRef = ref<any>(null)
    const keepaliveInclude = ref(['Foo'])
    const App = {
      render: () => {
        return h(KeepAlive, { include: keepaliveInclude.value }, () =>
          toggle.value ? h(AsyncComp, { ref: instanceRef }) : null,
        )
      },
    }

    render(h(App), root)
    // async component has not been resolved
    expect(serializeInner(root)).toBe('<!---->')

    resolve!({
      name: 'Foo',
      data: () => ({ count: 0 }),
      render() {
        return h('p', this.count)
      },
    })

    await timeout()
    // resolved
    expect(serializeInner(root)).toBe('<p>0</p>')

    // change state + toggle out + update `include` props
    instanceRef.value.count++
    toggle.value = false
    keepaliveInclude.value = ['Foo']
    await nextTick()
    expect(serializeInner(root)).toBe('<!---->')

    // toggle in, state should be maintained
    toggle.value = true
    await nextTick()
    expect(serializeInner(root)).toBe('<p>1</p>')
  })

  describe('pause while deactivated', () => {
    test('leaves a deactivated entry running without the pause prop', async () => {
      const count = ref(0)
      const show = ref(true)
      const log: string[] = []
      const Page = {
        setup() {
          watch(count, () => log.push('watcher'))
          return () => (log.push('render'), h('div', count.value))
        },
      }
      render(
        h({
          render: () => h(KeepAlive, null, () => (show.value ? h(Page) : null)),
        }),
        root,
      )
      show.value = false
      await nextTick()
      log.length = 0

      count.value++
      await nextTick()
      expect(log).toEqual(['watcher', 'render'])
    })

    test('holds the effects of a deactivated entry until it is activated', async () => {
      const count = ref(0)
      const show = ref(true)
      const log: string[] = []
      const Leaf = {
        setup() {
          return () => (log.push('leaf render'), h('i', count.value))
        },
      }
      const Page = {
        setup() {
          watch(count, () => log.push('pre watcher'))
          watch(count, () => log.push('post watcher'), { flush: 'post' })
          watch(count, () => log.push('sync watcher'), { flush: 'sync' })
          watchEffect(() => log.push('watchEffect ' + count.value))
          onActivated(() => log.push('activated'))
          return () => (
            log.push('page render'),
            h('div', [count.value, h(Leaf)])
          )
        },
      }
      const App = {
        render: () =>
          h(KeepAlive, { pause: true }, () => (show.value ? h(Page) : null)),
      }
      render(h(App), root)
      show.value = false
      await nextTick()
      log.length = 0

      count.value++
      await nextTick()
      count.value++
      await nextTick()
      expect(log).toEqual([])
      expect(serializeInner(root)).toBe('<!---->')

      show.value = true
      await nextTick()
      expect(serializeInner(root)).toBe('<div>2<i>2</i></div>')
      expect(log).toEqual([
        'sync watcher',
        'pre watcher',
        'watchEffect 2',
        'page render',
        'leaf render',
        'post watcher',
        'activated',
      ])

      log.length = 0
      count.value++
      await nextTick()
      expect(serializeInner(root)).toBe('<div>3<i>3</i></div>')
      expect(log).toContain('page render')
    })

    test('finishes the updates of the tick that deactivates the entry', async () => {
      const count = ref(0)
      const show = ref(true)
      const log: string[] = []
      const Page = {
        setup() {
          watch(count, () => log.push('pre watcher'))
          watch(count, () => log.push('sync watcher'), { flush: 'sync' })
          onActivated(() => log.push('activated'))
          onDeactivated(() => log.push('deactivated'))
          return () => (log.push('page render'), h('div', count.value))
        },
      }
      const App = {
        render: () =>
          h(KeepAlive, { pause: true }, () => (show.value ? h(Page) : null)),
      }
      render(h(App), root)
      log.length = 0

      count.value++
      show.value = false
      await nextTick()
      expect(log).toEqual([
        'sync watcher',
        'pre watcher',
        'page render',
        'deactivated',
      ])

      log.length = 0
      show.value = true
      await nextTick()
      expect(serializeInner(root)).toBe('<div>1</div>')
      expect(log).toEqual(['activated'])
    })

    test('pauses the cached entries of a nested KeepAlive with the outer entry', async () => {
      const count = ref(0)
      const outer = ref(true)
      const inner = ref('X')
      const log: string[] = []
      const X = {
        name: 'X',
        setup: () => () => (log.push('X render'), h('p', count.value)),
      }
      const Y = {
        name: 'Y',
        setup: () => () => (log.push('Y render'), h('b', count.value)),
      }
      const Page = {
        setup: () => () =>
          h(KeepAlive, { pause: true }, () => h(inner.value === 'X' ? X : Y)),
      }
      const App = {
        render: () =>
          h(KeepAlive, { pause: true }, () => (outer.value ? h(Page) : null)),
      }
      render(h(App), root)
      inner.value = 'Y'
      await nextTick()
      outer.value = false
      await nextTick()
      log.length = 0

      count.value++
      await nextTick()
      expect(log).toEqual([])

      outer.value = true
      await nextTick()
      expect(serializeInner(root)).toBe('<b>1</b>')
      // X was deactivated by the inner KeepAlive, which still holds it
      expect(log).toEqual(['Y render'])

      inner.value = 'X'
      await nextTick()
      expect(serializeInner(root)).toBe('<p>1</p>')
      expect(log).toEqual(['Y render', 'X render'])
    })

    test.each([false, true])(
      'mounts children of the catch-up render before activated (same turn: %s)',
      async sameTurn => {
        const flag = ref(false)
        const show = ref(true)
        const log: string[] = []
        const Leaf = {
          setup() {
            onMounted(() => log.push('leaf mounted'))
            onActivated(() => log.push('leaf activated'))
            return () => h('i')
          },
        }
        const Body = {
          setup: () => () => h('div', [flag.value ? h(Leaf) : null]),
        }
        const Page = {
          setup() {
            onActivated(() => log.push('page activated'))
            return () => h(Body)
          },
        }
        const App = {
          render: () =>
            h(KeepAlive, { pause: true }, () => (show.value ? h(Page) : null)),
        }
        render(h(App), root)
        show.value = false
        await nextTick()
        log.length = 0

        flag.value = true
        if (!sameTurn) await nextTick()
        expect(log).toEqual([])
        show.value = true
        await nextTick()
        expect(serializeInner(root)).toBe('<div><i></i></div>')
        expect(log).toEqual([
          'leaf mounted',
          'leaf activated',
          'page activated',
        ])
      },
    )

    describe('a root replaced while the entry is paused enters as one replaced on return', () => {
      const selfLoading = (loaded: Ref<boolean>): Component => ({
        setup: () => () =>
          loaded.value ? h('article', 'content') : h('p', 'loading'),
      })
      const PropsPage = {
        props: ['loaded'],
        setup: (props: any) => () =>
          props.loaded ? h('article', 'content') : h('p', 'loading'),
      }
      const cases: [
        string,
        (loaded: Ref<boolean>) => Component,
        boolean,
        boolean?,
      ][] = [
        ['by its own state', selfLoading, false],
        ['by its own state in the return turn', selfLoading, true],
        [
          'by a child in the return turn',
          loaded => {
            const Leaf = selfLoading(loaded)
            return { setup: () => () => h(Leaf) }
          },
          true,
        ],
        ['by props', () => PropsPage, false, true],
      ]
      // without `pause` the root is replaced on return, which is what a
      // paused entry catches up to
      const run = async (
        makePage: (loaded: Ref<boolean>) => Component,
        byProps: boolean,
        pause: boolean,
        sameTurn: boolean,
      ) => {
        const loaded = ref(false)
        const show = ref(true)
        const log: string[] = []
        const Page = makePage(loaded)
        const B = { render: () => h('b', 'B') }
        render(
          h({
            render: () =>
              h(
                BaseTransition,
                {
                  onBeforeEnter: (el: any) => log.push('beforeEnter ' + el.tag),
                  onEnter: (el: any, done: () => void) => {
                    log.push('enter ' + el.tag)
                    done()
                  },
                  onLeave: (el: any, done: () => void) => {
                    log.push('leave ' + el.tag)
                    done()
                  },
                },
                () =>
                  h(KeepAlive, pause ? { pause: true } : null, () =>
                    show.value
                      ? h(Page, byProps ? { loaded: loaded.value } : null)
                      : h(B),
                  ),
              ),
          }),
          root,
        )
        show.value = false
        await nextTick()
        log.length = 0

        loaded.value = true
        if (!sameTurn) await nextTick()
        expect(log).toEqual([])
        show.value = true
        await nextTick()
        await nextTick()
        const result = [serializeInner(root), ...log]
        render(null, root)
        return result
      }

      test.each(cases)('%s', async (_, makePage, sameTurn, byProps) => {
        const paused = await run(makePage, !!byProps, true, sameTurn)
        expect(paused[0]).toBe('<article>content</article>')
        expect(paused).toEqual(await run(makePage, !!byProps, false, true))
      })
    })

    test('a pruned paused entry never runs its held effects', async () => {
      const count = ref(0)
      const show = ref(true)
      const include = ref(['Page'])
      const log: string[] = []
      const Page = {
        name: 'Page',
        setup() {
          watch(count, () => log.push('pre watcher'))
          onUnmounted(() => log.push('unmounted'))
          return () => (log.push('page render'), h('div', count.value))
        },
      }
      const App = {
        render: () =>
          h(KeepAlive, { include: include.value, pause: true }, () =>
            show.value ? h(Page) : null,
          ),
      }
      render(h(App), root)
      show.value = false
      await nextTick()
      log.length = 0

      count.value++
      await nextTick()
      include.value = []
      await nextTick()
      count.value++
      await nextTick()
      expect(log).toEqual(['unmounted'])
    })

    test('keeps running a shared watcher created in the setup of a paused page', async () => {
      const count = ref(0)
      const show = ref(true)
      const log: string[] = []
      const storeScope = effectScope(true)
      let store: object | undefined
      const useStore = () =>
        store ||
        (store = storeScope.run(() => {
          watch(count, v => log.push('store watcher ' + v))
          return {}
        }))
      const Page = {
        setup() {
          useStore()
          return () => h('div')
        },
      }
      const Other = {
        setup() {
          useStore()
          return () => h('p')
        },
      }
      const App = {
        render: () =>
          h(KeepAlive, { pause: true }, () =>
            show.value ? h(Page) : h(Other),
          ),
      }
      render(h(App), root)
      show.value = false
      await nextTick()

      count.value++
      await nextTick()
      expect(log).toEqual(['store watcher 1'])
      storeScope.stop()
    })

    test('pauses a bare effect created in the setup of a page', async () => {
      const count = ref(0)
      const show = ref(true)
      const log: number[] = []
      const Page = {
        setup() {
          effect(() => log.push(count.value))
          return () => h('div')
        },
      }
      const App = {
        render: () =>
          h(KeepAlive, { pause: true }, () => (show.value ? h(Page) : null)),
      }
      render(h(App), root)
      show.value = false
      await nextTick()

      count.value++
      expect(log).toEqual([0])
      show.value = true
      await nextTick()
      expect(log).toEqual([0, 1])
    })

    test.each(['sync watcher', 'render'])(
      'rethrows what its catch-up throws, in place (%s)',
      async source => {
        const count = ref(0)
        const show = ref(true)
        const Page = {
          setup() {
            if (source === 'sync watcher') {
              watch(
                count,
                () => {
                  throw new Error('boom')
                },
                { flush: 'sync' },
              )
            }
            return () => {
              if (source === 'render' && count.value) throw new Error('boom')
              return h('div', 'page')
            }
          },
        }
        const App = {
          render: () =>
            h(KeepAlive, { pause: true }, () => (show.value ? h(Page) : null)),
        }
        render(h(App), root)
        show.value = false
        await nextTick()

        count.value++
        show.value = true
        await expect(nextTick()).rejects.toThrow('boom')
        expect(serializeInner(root)).toBe('<div>page</div>')
        expect('Unhandled error').toHaveBeenWarned()
      },
    )

    test('stops a catch-up that keeps updating itself', async () => {
      const n = ref(0)
      const show = ref(true)
      const Page = {
        setup() {
          watch(n, v => {
            if (v < 200) n.value++
          })
          return () => h('div')
        },
      }
      const App = {
        render: () =>
          h(KeepAlive, { pause: true }, () => (show.value ? h(Page) : null)),
      }
      render(h(App), root)
      show.value = false
      await nextTick()

      n.value = 1
      show.value = true
      await expect(nextTick()).rejects.toMatch(
        'Maximum recursive updates exceeded',
      )
      expect(n.value).toBeLessThan(200)
      expect(serializeInner(root)).toBe('<div></div>')
      expect('Unhandled error').toHaveBeenWarned()
    })

    test('lets the deactivated hooks close a teleported modal', async () => {
      const show = ref(true)
      const target = nodeOps.createElement('div')
      const Page = {
        setup() {
          const open = ref(true)
          onDeactivated(() => {
            open.value = false
          })
          return () => [
            h('div', 'page'),
            h(Teleport, { to: target }, open.value ? [h('p', 'modal')] : []),
          ]
        },
      }
      const App = {
        render: () =>
          h(KeepAlive, { pause: true }, () => (show.value ? h(Page) : null)),
      }
      render(h(App), root)
      expect(serializeInner(target)).toBe('<p>modal</p>')

      show.value = false
      await nextTick()
      expect(serializeInner(target)).toBe('')
    })

    test.each([
      ['of the page', false],
      ['of a child the page passes it to', true],
    ])(
      'lets the deactivated hooks close a teleported modal through a post watcher %s',
      async (_, viaChild) => {
        const show = ref(true)
        const count = ref(0)
        let renders = 0
        const target = nodeOps.createElement('div')
        const Modal = {
          props: ['open'],
          setup(props: any) {
            const visible = ref(props.open)
            watch(
              () => props.open,
              value => {
                visible.value = value
              },
              { flush: 'post' },
            )
            return () =>
              h(
                Teleport,
                { to: target },
                visible.value ? [h('p', 'modal')] : [],
              )
          },
        }
        const Page = {
          setup() {
            const open = ref(true)
            const visible = ref(true)
            watch(
              open,
              value => {
                visible.value = value
              },
              { flush: 'post' },
            )
            onDeactivated(() => {
              open.value = false
            })
            return () =>
              h('div', [
                (renders++, count.value),
                viaChild
                  ? h(Modal, { open: open.value })
                  : h(
                      Teleport,
                      { to: target },
                      visible.value ? [h('p', 'modal')] : [],
                    ),
              ])
          },
        }
        render(
          h({
            render: () =>
              h(KeepAlive, { pause: true }, () =>
                show.value ? h(Page) : null,
              ),
          }),
          root,
        )
        expect(serializeInner(target)).toBe('<p>modal</p>')

        show.value = false
        await nextTick()
        expect(serializeInner(target)).toBe('')
        // and then pauses
        const rendered = renders
        count.value++
        await nextTick()
        expect(renders).toBe(rendered)
      },
    )

    test.each([
      ['pre', ['watch new', 'render new']],
      // as without the pause, it runs before the parent hands over the props
      ['sync', ['watch old', 'render new']],
    ] as const)(
      'delivers the props it returns with as an unpaused page (%s watcher)',
      async (flush, expected) => {
        const show = ref(true)
        const id = ref('old')
        const revision = ref(0)
        const log: string[] = []
        const Page = {
          props: ['id'],
          setup(props: any) {
            watch(revision, () => log.push(`watch ${props.id}`), { flush })
            return () => (log.push(`render ${props.id}`), h('div', props.id))
          },
        }
        render(
          h({
            render: () =>
              h(KeepAlive, { pause: true }, () =>
                show.value ? h(Page, { id: id.value }) : null,
              ),
          }),
          root,
        )
        show.value = false
        await nextTick()
        log.length = 0

        show.value = true
        id.value = 'new'
        revision.value++
        await nextTick()
        expect(serializeInner(root)).toBe('<div>new</div>')
        expect(log).toEqual(expected)
      },
    )

    test('renders the slots it returns with', async () => {
      const show = ref(true)
      const extra = ref(false)
      const Page = {
        setup:
          (_: any, { slots }: any) =>
          () =>
            h('div', slots.extra ? slots.extra() : 'none'),
      }
      render(
        h({
          render: () =>
            h(KeepAlive, { pause: true }, () =>
              show.value
                ? h(Page, null, extra.value ? { extra: () => 'extra' } : {})
                : null,
            ),
        }),
        root,
      )
      expect(serializeInner(root)).toBe('<div>none</div>')
      show.value = false
      await nextTick()

      extra.value = true
      show.value = true
      await nextTick()
      expect(serializeInner(root)).toBe('<div>extra</div>')
    })

    test('pauses every entry deactivated in the same tick', async () => {
      const show = ref(true)
      const count = ref(0)
      const log: string[] = []
      const page = (name: string) => ({
        setup: () => () => (log.push(name), h('i', count.value)),
      })
      const A = page('a')
      const B = page('b')
      render(
        h({
          render: () => [
            h(KeepAlive, { pause: true }, () => (show.value ? h(A) : null)),
            h(KeepAlive, { pause: true }, () => (show.value ? h(B) : null)),
          ],
        }),
        root,
      )
      show.value = false
      await nextTick()
      log.length = 0

      count.value++
      await nextTick()
      expect(log).toEqual([])
      show.value = true
      await nextTick()
      expect(log).toEqual(['a', 'b'])
      expect(serializeInner(root)).toBe('<i>1</i><i>1</i>')
    })

    test('a function ref sees its element in place on return', async () => {
      const show = ref(true)
      const id = ref('a')
      const parents: unknown[] = []
      const Page = {
        props: ['id'],
        setup: (props: any) => () =>
          h(
            'div',
            { ref: (el: any) => el && parents.push(el.parentNode) },
            props.id,
          ),
      }
      render(
        h({
          render: () =>
            h(KeepAlive, { pause: true }, () =>
              show.value ? h(Page, { id: id.value }) : null,
            ),
        }),
        root,
      )
      show.value = false
      await nextTick()
      parents.length = 0

      id.value = 'b'
      show.value = true
      await nextTick()
      expect(serializeInner(root)).toBe('<div>b</div>')
      expect(parents).toEqual([root])
    })

    test('passes its vnode update hooks the vnode it left with', async () => {
      const show = ref(true)
      const id = ref('old')
      const log: string[] = []
      const record = (hook: string) => (vnode: VNode, oldVNode: VNode) =>
        log.push(`${hook} ${vnode.props!.id} ${oldVNode.props!.id}`)
      const Page = {
        props: ['id'],
        setup: (props: any) => () => h('div', props.id),
      }
      render(
        h({
          render: () =>
            h(KeepAlive, { pause: true }, () =>
              show.value
                ? h(Page, {
                    id: id.value,
                    onVnodeBeforeUpdate: record('beforeUpdate'),
                    onVnodeUpdated: record('updated'),
                  })
                : null,
            ),
        }),
        root,
      )
      show.value = false
      await nextTick()
      id.value = 'new'
      await nextTick()

      show.value = true
      await nextTick()
      expect(serializeInner(root)).toBe('<div>new</div>')
      expect(log).toEqual(['beforeUpdate new old', 'updated new old'])
    })

    test('keeps the queued jobs of other components when a catch-up throws', async () => {
      const count = ref(0)
      const other = ref(0)
      const Page = {
        setup: () => () => {
          if (count.value) throw new Error('boom')
          return h('div', 'page')
        },
      }
      const Other = {
        setup: () => () => h('p', other.value),
      }
      const App = {
        props: ['show'],
        setup: (props: any) => () => [
          h(Other),
          h(KeepAlive, { pause: true }, () => (props.show ? h(Page) : null)),
        ],
      }
      render(h(App, { show: true }), root)
      render(h(App, { show: false }), root)
      await nextTick()

      count.value++
      other.value++
      expect(() => render(h(App, { show: true }), root)).toThrow('boom')
      await nextTick()
      expect(serializeInner(root)).toBe('<p>1</p><div>page</div>')
      expect('Unhandled error').toHaveBeenWarned()
    })

    test('runs the jobs a catch-up queues for other components in order', async () => {
      const count = ref(0)
      const a = ref(0)
      const b = ref(0)
      const show = ref(true)
      const log: string[] = []
      const First = {
        setup: () => () => (log.push('first'), h('i', a.value)),
      }
      const Second = {
        setup: () => () => (log.push('second'), h('b', b.value)),
      }
      const Page = {
        setup() {
          watch(count, () => {
            a.value++
          })
          return () => h('div')
        },
      }
      // the switch comes from the parent, so `Second` is still queued when
      // the page catches up
      const App = {
        render: () => {
          const page = show.value ? h(Page) : null
          return [
            h(First),
            h(Second),
            h(KeepAlive, { pause: true }, () => page),
          ]
        },
      }
      render(h(App), root)
      show.value = false
      await nextTick()
      count.value++
      await nextTick()
      log.length = 0

      b.value++
      show.value = true
      await nextTick()
      expect(log).toEqual(['first', 'second'])
      expect(serializeInner(root)).toBe('<i>1</i><b>1</b><div></div>')
    })

    describe('a Suspense switching its branch on return under an out-in transition', () => {
      const Old = { render: () => h('p', 'old') }
      // a layout rendering only its nested view, which is `Old` until the
      // layout returns showing `New`
      const mount = (New: Component, fallback?: () => VNode) => {
        const show = ref(true)
        const view = shallowRef<Component>(Old)
        const leaves: (() => void)[] = []
        const Layout = {
          setup: () => () =>
            h(
              BaseTransition,
              {
                mode: 'out-in',
                onEnter: (_el: any, done: () => void) => done(),
                onLeave: (_el: any, done: () => void) => void leaves.push(done),
              },
              () =>
                h(
                  Suspense,
                  { timeout: 0 },
                  { default: () => h(view.value), fallback },
                ),
            ),
        }
        render(
          h({
            render: () => [
              h(KeepAlive, { pause: true }, [show.value ? h(Layout) : null]),
              h('b'),
            ],
          }),
          root,
        )
        const finishLeaves = async () => {
          leaves.splice(0).forEach(done => done())
          await nextTick()
        }
        const goBack = async () => {
          show.value = false
          await nextTick()
          await finishLeaves()
          show.value = true
          view.value = New
          await nextTick()
          await finishLeaves()
        }
        return { goBack, finishLeaves }
      }

      test('a resolved branch', async () => {
        const New = { render: () => h('p', 'new') }
        const { goBack } = mount(New)
        await goBack()
        expect(serializeInner(root)).toBe('<p>new</p><b></b>')
      })

      test('a pending branch showing its fallback', async () => {
        let resolveNew!: (comp: any) => void
        const New = defineAsyncComponent(
          () => new Promise<any>(r => (resolveNew = r)),
        )
        const { goBack, finishLeaves } = mount(New, () => h('i', 'loading'))
        await goBack()
        expect(serializeInner(root)).toBe('<i>loading</i><b></b>')

        resolveNew({ render: () => h('p', 'new') })
        await timeout()
        await finishLeaves()
        expect(serializeInner(root)).toBe('<p>new</p><b></b>')
      })
    })

    describe('keeps a pause of its own scope apart', () => {
      const mount = () => {
        const show = ref(true)
        const count = ref(0)
        const log: string[] = []
        let scope!: EffectScope
        const Page = {
          setup() {
            scope = getCurrentScope()!
            watch(count, value => log.push(`watch ${value}`))
            return () => h('div', count.value)
          },
        }
        render(
          h({
            render: () =>
              h(KeepAlive, { pause: true }, () =>
                show.value ? h(Page) : null,
              ),
          }),
          root,
        )
        return { show, count, log, scope }
      }

      test('a pause of its own outlives the deactivation', async () => {
        const { show, count, log, scope } = mount()
        scope.pause()
        show.value = false
        await nextTick()
        show.value = true
        await nextTick()

        count.value++
        await nextTick()
        expect(log).toEqual([])
        expect(serializeInner(root)).toBe('<div>0</div>')
      })

      test('ending its own pause leaves the deactivated entry paused', async () => {
        const { show, count, log, scope } = mount()
        scope.pause()
        show.value = false
        await nextTick()
        scope.resume()

        count.value++
        await nextTick()
        expect(log).toEqual([])
        show.value = true
        await nextTick()
        expect(log).toEqual(['watch 1'])
        expect(serializeInner(root)).toBe('<div>1</div>')
      })
    })

    test.each(['slots', 'props'])(
      'returns with inputs shaped unlike those it left with (%s)',
      async shape => {
        const show = ref(true)
        const first = ref(true)
        const Page = {
          props: ['id'],
          setup:
            (props: any, { slots }: any) =>
            () =>
              h('div', slots.default ? slots.default() : props.id || 'none'),
        }
        const leaving = () =>
          shape === 'slots'
            ? h(Page, null, { default: () => 'slot' })
            : createVNode(Page, { id: 'id' }, null, PatchFlags.PROPS, ['id'])
        render(
          h({
            render: () =>
              h(KeepAlive, { pause: true }, () =>
                show.value ? (first.value ? leaving() : h(Page)) : null,
              ),
          }),
          root,
        )
        show.value = false
        await nextTick()

        first.value = false
        show.value = true
        await nextTick()
        expect(serializeInner(root)).toBe('<div>none</div>')
      },
    )

    test.each(['pre', 'sync'] as const)(
      'emits to the listener it returns with (%s watcher)',
      async flush => {
        const show = ref(true)
        const id = ref('a')
        const log: string[] = []
        const Page = {
          props: ['id'],
          emits: ['change'],
          setup(props: any, { emit }: any) {
            watch(
              () => props.id,
              value => emit('change', value),
              { flush },
            )
            return () => h('div', props.id)
          },
        }
        const listener = (name: string) => (value: string) =>
          log.push(`${name} ${value}`)
        render(
          h({
            render: () =>
              h(KeepAlive, { pause: true }, () =>
                show.value
                  ? h(Page, { id: id.value, onChange: listener(id.value) })
                  : null,
              ),
          }),
          root,
        )
        show.value = false
        await nextTick()

        id.value = 'b'
        show.value = true
        await nextTick()
        expect(log).toEqual(['b b'])
      },
    )

    test('hands a root it replaced under a pause of its own to its wrappers', async () => {
      const show = ref(true)
      const big = ref(false)
      const items = ref(['page'])
      const Page = {
        props: ['big'],
        setup(props: any) {
          const scope = getCurrentScope()!
          onDeactivated(() => scope.pause())
          onActivated(() => scope.resume())
          return () => (props.big ? h('article', 'big') : h('p', 'small'))
        },
      }
      const Outlet = {
        setup: () => () =>
          h(KeepAlive, { pause: true }, () =>
            show.value ? h(Page, { big: big.value }) : null,
          ),
      }
      render(
        h({
          render: () =>
            h(
              'div',
              items.value.map(item =>
                item === 'page'
                  ? h(Outlet, { key: item })
                  : h('b', { key: item }, item),
              ),
            ),
        }),
        root,
      )
      show.value = false
      await nextTick()

      big.value = true
      show.value = true
      await nextTick()
      items.value = ['sibling', 'page']
      await nextTick()
      expect(serializeInner(root)).toBe(
        '<div><b>sibling</b><article>big</article></div>',
      )
    })
  })
})
