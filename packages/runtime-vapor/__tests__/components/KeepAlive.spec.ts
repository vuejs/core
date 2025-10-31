import {
  h,
  nextTick,
  onActivated,
  onBeforeMount,
  onDeactivated,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  shallowRef,
  vModelText,
  withDirectives,
} from 'vue'
import type { LooseRawProps, VaporComponent } from '../../src/component'
import { makeRender } from '../_utils'
import { VaporKeepAliveImpl as VaporKeepAlive } from '../../src/components/KeepAlive'
import {
  child,
  createComponent,
  createDynamicComponent,
  createIf,
  createTemplateRefSetter,
  createVaporApp,
  defineVaporAsyncComponent,
  defineVaporComponent,
  renderEffect,
  setText,
  template,
  vaporInteropPlugin,
} from '../../src'

const define = makeRender()
const timeout = (n: number = 0) => new Promise(r => setTimeout(r, n))

describe('VaporKeepAlive', () => {
  let one: VaporComponent
  let two: VaporComponent
  let oneTest: VaporComponent
  let views: Record<string, VaporComponent>
  let root: HTMLDivElement

  type HookType = {
    beforeMount: any
    mounted: any
    activated: any
    deactivated: any
    unmounted: any
  }

  let oneHooks = {} as HookType
  let oneTestHooks = {} as HookType
  let twoHooks = {} as HookType

  beforeEach(() => {
    root = document.createElement('div')
    oneHooks = {
      beforeMount: vi.fn(),
      mounted: vi.fn(),
      activated: vi.fn(),
      deactivated: vi.fn(),
      unmounted: vi.fn(),
    }
    one = defineVaporComponent({
      name: 'one',
      setup(_, { expose }) {
        onBeforeMount(() => oneHooks.beforeMount())
        onMounted(() => oneHooks.mounted())
        onActivated(() => oneHooks.activated())
        onDeactivated(() => oneHooks.deactivated())
        onUnmounted(() => oneHooks.unmounted())

        const msg = ref('one')
        expose({ setMsg: (m: string) => (msg.value = m) })

        const n0 = template(`<div> </div>`)() as any
        const x0 = child(n0) as any
        renderEffect(() => setText(x0, msg.value))
        return n0
      },
    })
    oneTestHooks = {
      beforeMount: vi.fn(),
      mounted: vi.fn(),
      activated: vi.fn(),
      deactivated: vi.fn(),
      unmounted: vi.fn(),
    }
    oneTest = defineVaporComponent({
      name: 'oneTest',
      setup() {
        onBeforeMount(() => oneTestHooks.beforeMount())
        onMounted(() => oneTestHooks.mounted())
        onActivated(() => oneTestHooks.activated())
        onDeactivated(() => oneTestHooks.deactivated())
        onUnmounted(() => oneTestHooks.unmounted())

        const msg = ref('oneTest')
        const n0 = template(`<div> </div>`)() as any
        const x0 = child(n0) as any
        renderEffect(() => setText(x0, msg.value))
        return n0
      },
    })
    twoHooks = {
      beforeMount: vi.fn(),
      mounted: vi.fn(),
      activated: vi.fn(),
      deactivated: vi.fn(),
      unmounted: vi.fn(),
    }
    two = defineVaporComponent({
      name: 'two',
      setup() {
        onBeforeMount(() => twoHooks.beforeMount())
        onMounted(() => twoHooks.mounted())
        onActivated(() => {
          twoHooks.activated()
        })
        onDeactivated(() => twoHooks.deactivated())
        onUnmounted(() => twoHooks.unmounted())

        const msg = ref('two')
        const n0 = template(`<div> </div>`)() as any
        const x0 = child(n0) as any
        renderEffect(() => setText(x0, msg.value))
        return n0
      },
    })
    views = {
      one,
      oneTest,
      two,
    }
  })

  function assertHookCalls(
    hooks: {
      beforeMount: any
      mounted: any
      activated: any
      deactivated: any
      unmounted: any
    },
    callCounts: number[],
  ) {
    expect([
      hooks.beforeMount.mock.calls.length,
      hooks.mounted.mock.calls.length,
      hooks.activated.mock.calls.length,
      hooks.deactivated.mock.calls.length,
      hooks.unmounted.mock.calls.length,
    ]).toEqual(callCounts)
  }

  test('should preserve state', async () => {
    const viewRef = ref('one')
    const instanceRef = ref<any>(null)

    const { mount } = define({
      setup() {
        const setTemplateRef = createTemplateRefSetter()
        const n4 = createComponent(VaporKeepAlive, null, {
          default: () => {
            const n0 = createDynamicComponent(() => views[viewRef.value]) as any
            setTemplateRef(n0, instanceRef)
            return n0
          },
        })
        return n4
      },
    }).create()

    mount(root)
    expect(root.innerHTML).toBe(`<div>one</div><!--dynamic-component-->`)

    instanceRef.value.setMsg('changed')
    await nextTick()
    expect(root.innerHTML).toBe(`<div>changed</div><!--dynamic-component-->`)

    viewRef.value = 'two'
    await nextTick()
    expect(root.innerHTML).toBe(`<div>two</div><!--dynamic-component-->`)

    viewRef.value = 'one'
    await nextTick()
    expect(root.innerHTML).toBe(`<div>changed</div><!--dynamic-component-->`)
  })

  test('should call correct lifecycle hooks', async () => {
    const toggle = ref(true)
    const viewRef = ref('one')

    const { mount } = define({
      setup() {
        return createIf(
          () => toggle.value,
          () =>
            createComponent(VaporKeepAlive, null, {
              default: () => createDynamicComponent(() => views[viewRef.value]),
            }),
        )
      },
    }).create()
    mount(root)
    expect(root.innerHTML).toBe(
      `<div>one</div><!--dynamic-component--><!--if-->`,
    )
    assertHookCalls(oneHooks, [1, 1, 1, 0, 0])
    assertHookCalls(twoHooks, [0, 0, 0, 0, 0])

    // toggle kept-alive component
    viewRef.value = 'two'
    await nextTick()
    expect(root.innerHTML).toBe(
      `<div>two</div><!--dynamic-component--><!--if-->`,
    )
    assertHookCalls(oneHooks, [1, 1, 1, 1, 0])
    assertHookCalls(twoHooks, [1, 1, 1, 0, 0])

    viewRef.value = 'one'
    await nextTick()
    expect(root.innerHTML).toBe(
      `<div>one</div><!--dynamic-component--><!--if-->`,
    )
    assertHookCalls(oneHooks, [1, 1, 2, 1, 0])
    assertHookCalls(twoHooks, [1, 1, 1, 1, 0])

    viewRef.value = 'two'
    await nextTick()
    expect(root.innerHTML).toBe(
      `<div>two</div><!--dynamic-component--><!--if-->`,
    )
    assertHookCalls(oneHooks, [1, 1, 2, 2, 0])
    assertHookCalls(twoHooks, [1, 1, 2, 1, 0])

    // teardown keep-alive, should unmount all components including cached
    toggle.value = false
    await nextTick()
    expect(root.innerHTML).toBe(`<!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 2, 2, 1])
    assertHookCalls(twoHooks, [1, 1, 2, 2, 1])
  })

  test('should call correct lifecycle hooks when toggle the KeepAlive first', async () => {
    const toggle = ref(true)
    const viewRef = ref('one')

    const { mount } = define({
      setup() {
        return createIf(
          () => toggle.value,
          () =>
            createComponent(VaporKeepAlive, null, {
              default: () => createDynamicComponent(() => views[viewRef.value]),
            }),
        )
      },
    }).create()
    mount(root)
    expect(root.innerHTML).toBe(
      `<div>one</div><!--dynamic-component--><!--if-->`,
    )
    assertHookCalls(oneHooks, [1, 1, 1, 0, 0])
    assertHookCalls(twoHooks, [0, 0, 0, 0, 0])

    // should unmount 'one' component when toggle the KeepAlive first
    toggle.value = false
    await nextTick()
    expect(root.innerHTML).toBe(`<!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 1, 1, 1])
    assertHookCalls(twoHooks, [0, 0, 0, 0, 0])

    toggle.value = true
    await nextTick()
    expect(root.innerHTML).toBe(
      `<div>one</div><!--dynamic-component--><!--if-->`,
    )
    assertHookCalls(oneHooks, [2, 2, 2, 1, 1])
    assertHookCalls(twoHooks, [0, 0, 0, 0, 0])

    // 1. the first time toggle kept-alive component
    viewRef.value = 'two'
    await nextTick()
    expect(root.innerHTML).toBe(
      `<div>two</div><!--dynamic-component--><!--if-->`,
    )
    assertHookCalls(oneHooks, [2, 2, 2, 2, 1])
    assertHookCalls(twoHooks, [1, 1, 1, 0, 0])

    // 2. should unmount all components including cached
    toggle.value = false
    await nextTick()
    expect(root.innerHTML).toBe(`<!--if-->`)
    assertHookCalls(oneHooks, [2, 2, 2, 2, 2])
    assertHookCalls(twoHooks, [1, 1, 1, 1, 1])
  })

  test('should call lifecycle hooks on nested components', async () => {
    const one = defineVaporComponent({
      name: 'one',
      setup() {
        onBeforeMount(() => oneHooks.beforeMount())
        onMounted(() => oneHooks.mounted())
        onActivated(() => oneHooks.activated())
        onDeactivated(() => oneHooks.deactivated())
        onUnmounted(() => oneHooks.unmounted())
        return createComponent(two)
      },
    })
    const toggle = ref(true)
    const { html } = define({
      setup() {
        return createComponent(VaporKeepAlive, null, {
          default() {
            return createIf(
              () => toggle.value,
              () =>
                createComponent(one as any, null, {
                  default: () => createDynamicComponent(() => views['one']),
                }),
            )
          },
        })
      },
    }).render()
    expect(html()).toBe(`<div>two</div><!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 1, 0, 0])
    assertHookCalls(twoHooks, [1, 1, 1, 0, 0])

    toggle.value = false
    await nextTick()
    expect(html()).toBe(`<!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 1, 1, 0])
    assertHookCalls(twoHooks, [1, 1, 1, 1, 0])

    toggle.value = true
    await nextTick()
    expect(html()).toBe(`<div>two</div><!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 2, 1, 0])
    assertHookCalls(twoHooks, [1, 1, 2, 1, 0])

    toggle.value = false
    await nextTick()
    expect(html()).toBe(`<!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 2, 2, 0])
    assertHookCalls(twoHooks, [1, 1, 2, 2, 0])
  })

  test('should call lifecycle hooks on nested components when root component no hooks', async () => {
    const spy = vi.fn()
    const two = defineVaporComponent({
      name: 'two',
      setup() {
        onActivated(() => spy())
        return template(`<div>two</div>`)()
      },
    })
    const one = defineVaporComponent({
      name: 'one',
      setup() {
        return createComponent(two)
      },
    })

    const toggle = ref(true)
    const { html } = define({
      setup() {
        return createComponent(VaporKeepAlive, null, {
          default() {
            return createIf(
              () => toggle.value,
              () => createComponent(one),
            )
          },
        })
      },
    }).render()

    expect(html()).toBe(`<div>two</div><!--if-->`)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  test('should call correct hooks for nested keep-alive', async () => {
    const toggle2 = ref(true)
    const one = defineVaporComponent({
      name: 'one',
      setup() {
        onBeforeMount(() => oneHooks.beforeMount())
        onMounted(() => oneHooks.mounted())
        onActivated(() => oneHooks.activated())
        onDeactivated(() => oneHooks.deactivated())
        onUnmounted(() => oneHooks.unmounted())
        return createComponent(VaporKeepAlive, null, {
          default() {
            return createIf(
              () => toggle2.value,
              () => createComponent(two),
            )
          },
        })
      },
    })

    const toggle1 = ref(true)
    const { html } = define({
      setup() {
        return createComponent(VaporKeepAlive, null, {
          default() {
            return createIf(
              () => toggle1.value,
              () => createComponent(one),
            )
          },
        })
      },
    }).render()

    expect(html()).toBe(`<div>two</div><!--if--><!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 1, 0, 0])
    assertHookCalls(twoHooks, [1, 1, 1, 0, 0])

    toggle1.value = false
    await nextTick()
    expect(html()).toBe(`<!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 1, 1, 0])
    assertHookCalls(twoHooks, [1, 1, 1, 1, 0])

    toggle1.value = true
    await nextTick()
    expect(html()).toBe(`<div>two</div><!--if--><!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 2, 1, 0])
    assertHookCalls(twoHooks, [1, 1, 2, 1, 0])

    // toggle nested instance
    toggle2.value = false
    await nextTick()
    expect(html()).toBe(`<!--if--><!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 2, 1, 0])
    assertHookCalls(twoHooks, [1, 1, 2, 2, 0])

    toggle2.value = true
    await nextTick()
    expect(html()).toBe(`<div>two</div><!--if--><!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 2, 1, 0])
    // problem is component one isDeactivated. leading to
    // the activated hook of two is not called
    assertHookCalls(twoHooks, [1, 1, 3, 2, 0])

    toggle1.value = false
    await nextTick()
    expect(html()).toBe(`<!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 2, 2, 0])
    assertHookCalls(twoHooks, [1, 1, 3, 3, 0])

    // toggle nested instance when parent is deactivated
    toggle2.value = false
    await nextTick()
    expect(html()).toBe(`<!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 2, 2, 0])
    assertHookCalls(twoHooks, [1, 1, 3, 3, 0]) // should not be affected

    toggle2.value = true
    await nextTick()
    expect(html()).toBe(`<!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 2, 2, 0])
    assertHookCalls(twoHooks, [1, 1, 3, 3, 0]) // should not be affected

    toggle1.value = true
    await nextTick()
    expect(html()).toBe(`<div>two</div><!--if--><!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 3, 2, 0])
    assertHookCalls(twoHooks, [1, 1, 4, 3, 0])

    toggle1.value = false
    toggle2.value = false
    await nextTick()
    expect(html()).toBe(`<!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 3, 3, 0])
    assertHookCalls(twoHooks, [1, 1, 4, 4, 0])

    toggle1.value = true
    await nextTick()
    expect(html()).toBe(`<!--if--><!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 4, 3, 0])
    assertHookCalls(twoHooks, [1, 1, 4, 4, 0]) // should remain inactive
  })

  async function assertNameMatch(props: LooseRawProps) {
    const outerRef = ref(true)
    const viewRef = ref('one')
    const { html } = define({
      setup() {
        return createIf(
          () => outerRef.value,
          () =>
            createComponent(VaporKeepAlive, props, {
              default: () => createDynamicComponent(() => views[viewRef.value]),
            }),
        )
      },
    }).render()

    expect(html()).toBe(`<div>one</div><!--dynamic-component--><!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 1, 0, 0])
    assertHookCalls(twoHooks, [0, 0, 0, 0, 0])

    viewRef.value = 'two'
    await nextTick()
    expect(html()).toBe(`<div>two</div><!--dynamic-component--><!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 1, 1, 0])
    assertHookCalls(twoHooks, [1, 1, 0, 0, 0])

    viewRef.value = 'one'
    await nextTick()
    expect(html()).toBe(`<div>one</div><!--dynamic-component--><!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 2, 1, 0])
    assertHookCalls(twoHooks, [1, 1, 0, 0, 1])

    viewRef.value = 'two'
    await nextTick()
    expect(html()).toBe(`<div>two</div><!--dynamic-component--><!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 2, 2, 0])
    assertHookCalls(twoHooks, [2, 2, 0, 0, 1])

    // teardown
    outerRef.value = false
    await nextTick()
    expect(html()).toBe(`<!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 2, 2, 1])
    assertHookCalls(twoHooks, [2, 2, 0, 0, 2])
  }

  async function assertNameMatchWithFlag(props: LooseRawProps) {
    const outerRef = ref(true)
    const viewRef = ref('one')
    const { html } = define({
      setup() {
        return createIf(
          () => outerRef.value,
          () =>
            createComponent(VaporKeepAlive, props, {
              default: () => createDynamicComponent(() => views[viewRef.value]),
            }),
        )
      },
    }).render()

    expect(html()).toBe(`<div>one</div><!--dynamic-component--><!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 1, 0, 0])
    assertHookCalls(oneTestHooks, [0, 0, 0, 0, 0])
    assertHookCalls(twoHooks, [0, 0, 0, 0, 0])

    viewRef.value = 'oneTest'
    await nextTick()
    expect(html()).toBe(`<div>oneTest</div><!--dynamic-component--><!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 1, 1, 0])
    assertHookCalls(oneTestHooks, [1, 1, 1, 0, 0])
    assertHookCalls(twoHooks, [0, 0, 0, 0, 0])

    viewRef.value = 'two'
    await nextTick()
    expect(html()).toBe(`<div>two</div><!--dynamic-component--><!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 1, 1, 0])
    assertHookCalls(oneTestHooks, [1, 1, 1, 1, 0])
    assertHookCalls(twoHooks, [1, 1, 0, 0, 0])

    viewRef.value = 'one'
    await nextTick()
    expect(html()).toBe(`<div>one</div><!--dynamic-component--><!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 2, 1, 0])
    assertHookCalls(oneTestHooks, [1, 1, 1, 1, 0])
    assertHookCalls(twoHooks, [1, 1, 0, 0, 1])

    viewRef.value = 'oneTest'
    await nextTick()
    expect(html()).toBe(`<div>oneTest</div><!--dynamic-component--><!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 2, 2, 0])
    assertHookCalls(oneTestHooks, [1, 1, 2, 1, 0])
    assertHookCalls(twoHooks, [1, 1, 0, 0, 1])

    viewRef.value = 'two'
    await nextTick()
    expect(html()).toBe(`<div>two</div><!--dynamic-component--><!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 2, 2, 0])
    assertHookCalls(oneTestHooks, [1, 1, 2, 2, 0])
    assertHookCalls(twoHooks, [2, 2, 0, 0, 1])

    // teardown
    outerRef.value = false
    await nextTick()
    expect(html()).toBe(`<!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 2, 2, 1])
    assertHookCalls(oneTestHooks, [1, 1, 2, 2, 1])
    assertHookCalls(twoHooks, [2, 2, 0, 0, 2])
  }

  async function assertNameMatchWithFlagExclude(props: LooseRawProps) {
    const outerRef = ref(true)
    const viewRef = ref('one')
    const { html } = define({
      setup() {
        return createIf(
          () => outerRef.value,
          () =>
            createComponent(VaporKeepAlive, props, {
              default: () => createDynamicComponent(() => views[viewRef.value]),
            }),
        )
      },
    }).render()

    expect(html()).toBe(`<div>one</div><!--dynamic-component--><!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 0, 0, 0])
    assertHookCalls(oneTestHooks, [0, 0, 0, 0, 0])
    assertHookCalls(twoHooks, [0, 0, 0, 0, 0])

    viewRef.value = 'oneTest'
    await nextTick()
    expect(html()).toBe(`<div>oneTest</div><!--dynamic-component--><!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 0, 0, 1])
    assertHookCalls(oneTestHooks, [1, 1, 0, 0, 0])
    assertHookCalls(twoHooks, [0, 0, 0, 0, 0])

    viewRef.value = 'two'
    await nextTick()
    expect(html()).toBe(`<div>two</div><!--dynamic-component--><!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 0, 0, 1])
    assertHookCalls(oneTestHooks, [1, 1, 0, 0, 1])
    assertHookCalls(twoHooks, [1, 1, 1, 0, 0])

    viewRef.value = 'one'
    await nextTick()
    expect(html()).toBe(`<div>one</div><!--dynamic-component--><!--if-->`)
    assertHookCalls(oneHooks, [2, 2, 0, 0, 1])
    assertHookCalls(oneTestHooks, [1, 1, 0, 0, 1])
    assertHookCalls(twoHooks, [1, 1, 1, 1, 0])

    viewRef.value = 'oneTest'
    await nextTick()
    expect(html()).toBe(`<div>oneTest</div><!--dynamic-component--><!--if-->`)
    assertHookCalls(oneHooks, [2, 2, 0, 0, 2])
    assertHookCalls(oneTestHooks, [2, 2, 0, 0, 1])
    assertHookCalls(twoHooks, [1, 1, 1, 1, 0])

    viewRef.value = 'two'
    await nextTick()
    expect(html()).toBe(`<div>two</div><!--dynamic-component--><!--if-->`)
    assertHookCalls(oneHooks, [2, 2, 0, 0, 2])
    assertHookCalls(oneTestHooks, [2, 2, 0, 0, 2])
    assertHookCalls(twoHooks, [1, 1, 2, 1, 0])

    // teardown
    outerRef.value = false
    await nextTick()
    expect(html()).toBe(`<!--if-->`)
    assertHookCalls(oneHooks, [2, 2, 0, 0, 2])
    assertHookCalls(oneTestHooks, [2, 2, 0, 0, 2])
    assertHookCalls(twoHooks, [1, 1, 2, 2, 1])
  }

  describe('props', () => {
    test('include (string)', async () => {
      await assertNameMatch({ include: () => 'one' })
    })

    test('include (regex)', async () => {
      await assertNameMatch({ include: () => /^one$/ })
    })

    test('include (regex with g flag)', async () => {
      await assertNameMatchWithFlag({ include: () => /one/g })
    })

    test('include (array)', async () => {
      await assertNameMatch({ include: () => ['one'] })
    })

    test('exclude (string)', async () => {
      await assertNameMatch({ exclude: () => 'two' })
    })

    test('exclude (regex)', async () => {
      await assertNameMatch({ exclude: () => /^two$/ })
    })

    test('exclude (regex with a flag)', async () => {
      await assertNameMatchWithFlagExclude({ exclude: () => /one/g })
    })

    test('exclude (array)', async () => {
      await assertNameMatch({ exclude: () => ['two'] })
    })

    test('include + exclude', async () => {
      await assertNameMatch({ include: () => 'one,two', exclude: () => 'two' })
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
      const views: Record<string, VaporComponent> = {
        a: defineVaporComponent({
          name: 'a',
          setup() {
            onBeforeMount(() => spyAC())
            onActivated(() => spyAA())
            onDeactivated(() => spyADA())
            onUnmounted(() => spyAUM())
            return template(`one`)()
          },
        }),
        b: defineVaporComponent({
          name: 'b',
          setup() {
            onBeforeMount(() => spyBC())
            onActivated(() => spyBA())
            onDeactivated(() => spyBDA())
            onUnmounted(() => spyBUM())
            return template(`two`)()
          },
        }),
        c: defineVaporComponent({
          name: 'c',
          setup() {
            onBeforeMount(() => spyCC())
            onActivated(() => spyCA())
            onDeactivated(() => spyCDA())
            onUnmounted(() => spyCUM())
            return template(`three`)()
          },
        }),
      }

      define({
        setup() {
          return createComponent(
            VaporKeepAlive,
            { max: () => 2 },
            {
              default: () => createDynamicComponent(() => views[viewRef.value]),
            },
          )
        },
      }).render()
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
  })

  describe('cache invalidation', () => {
    function setup() {
      const viewRef = ref('one')
      const includeRef = ref('one,two')
      define({
        setup() {
          return createComponent(
            VaporKeepAlive,
            { include: () => includeRef.value },
            {
              default: () => createDynamicComponent(() => views[viewRef.value]),
            },
          )
        },
      }).render()
      return { viewRef, includeRef }
    }

    function setupExclude() {
      const viewRef = ref('one')
      const excludeRef = ref('')
      define({
        setup() {
          return createComponent(
            VaporKeepAlive,
            { exclude: () => excludeRef.value },
            {
              default: () => createDynamicComponent(() => views[viewRef.value]),
            },
          )
        },
      }).render()
      return { viewRef, excludeRef }
    }

    test('on include change', async () => {
      const { viewRef, includeRef } = setup()

      viewRef.value = 'two'
      await nextTick()
      assertHookCalls(oneHooks, [1, 1, 1, 1, 0])
      assertHookCalls(twoHooks, [1, 1, 1, 0, 0])

      includeRef.value = 'two'
      await nextTick()
      assertHookCalls(oneHooks, [1, 1, 1, 1, 1])
      assertHookCalls(twoHooks, [1, 1, 1, 0, 0])

      viewRef.value = 'one'
      await nextTick()
      assertHookCalls(oneHooks, [2, 2, 1, 1, 1])
      assertHookCalls(twoHooks, [1, 1, 1, 1, 0])
    })

    test('on exclude change', async () => {
      const { viewRef, excludeRef } = setupExclude()

      viewRef.value = 'two'
      await nextTick()
      assertHookCalls(oneHooks, [1, 1, 1, 1, 0])
      assertHookCalls(twoHooks, [1, 1, 1, 0, 0])

      excludeRef.value = 'one'
      await nextTick()
      assertHookCalls(oneHooks, [1, 1, 1, 1, 1])
      assertHookCalls(twoHooks, [1, 1, 1, 0, 0])

      viewRef.value = 'one'
      await nextTick()
      assertHookCalls(oneHooks, [2, 2, 1, 1, 1])
      assertHookCalls(twoHooks, [1, 1, 1, 1, 0])
    })

    test('on include change + view switch', async () => {
      const { viewRef, includeRef } = setup()

      viewRef.value = 'two'
      await nextTick()
      assertHookCalls(oneHooks, [1, 1, 1, 1, 0])
      assertHookCalls(twoHooks, [1, 1, 1, 0, 0])

      includeRef.value = 'one'
      viewRef.value = 'one'
      await nextTick()
      assertHookCalls(oneHooks, [1, 1, 2, 1, 0])
      // two should be pruned
      assertHookCalls(twoHooks, [1, 1, 1, 1, 1])
    })

    test('on exclude change + view switch', async () => {
      const { viewRef, excludeRef } = setupExclude()

      viewRef.value = 'two'
      await nextTick()
      assertHookCalls(oneHooks, [1, 1, 1, 1, 0])
      assertHookCalls(twoHooks, [1, 1, 1, 0, 0])

      excludeRef.value = 'two'
      viewRef.value = 'one'
      await nextTick()
      assertHookCalls(oneHooks, [1, 1, 2, 1, 0])
      // two should be pruned
      assertHookCalls(twoHooks, [1, 1, 1, 1, 1])
    })

    test('should not prune current active instance', async () => {
      const { viewRef, includeRef } = setup()

      includeRef.value = 'two'
      await nextTick()
      assertHookCalls(oneHooks, [1, 1, 1, 0, 0])
      assertHookCalls(twoHooks, [0, 0, 0, 0, 0])

      viewRef.value = 'two'
      await nextTick()
      assertHookCalls(oneHooks, [1, 1, 1, 0, 1])
      assertHookCalls(twoHooks, [1, 1, 1, 0, 0])
    })

    async function assertAnonymous(include: boolean) {
      const oneBeforeMountHooks = vi.fn()
      const one = defineVaporComponent({
        name: 'one',
        setup() {
          onBeforeMount(() => oneBeforeMountHooks())
          return template(`one`)()
        },
      })

      const twoBeforeMountHooks = vi.fn()
      const two = defineVaporComponent({
        // anonymous
        setup() {
          onBeforeMount(() => twoBeforeMountHooks())
          return template(`two`)()
        },
      })

      const views: any = { one, two }
      const viewRef = ref('one')

      define({
        setup() {
          return createComponent(
            VaporKeepAlive,
            { include: () => (include ? 'one' : undefined) },
            {
              default: () => createDynamicComponent(() => views[viewRef.value]),
            },
          )
        },
      }).render()

      function assert(oneCreateCount: number, twoCreateCount: number) {
        expect(oneBeforeMountHooks.mock.calls.length).toBe(oneCreateCount)
        expect(twoBeforeMountHooks.mock.calls.length).toBe(twoCreateCount)
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

    test('should not cache anonymous component when include is specified', async () => {
      await assertAnonymous(true)
    })

    test('should cache anonymous components if include is not specified', async () => {
      await assertAnonymous(false)
    })

    test('should not destroy active instance when pruning cache', async () => {
      const unmounted = vi.fn()
      const Foo = defineVaporComponent({
        setup() {
          onUnmounted(() => unmounted())
          return template(`foo`)()
        },
      })

      const includeRef = ref(['foo'])
      define({
        setup() {
          return createComponent(
            VaporKeepAlive,
            { include: () => includeRef.value },
            {
              default: () => createDynamicComponent(() => Foo),
            },
          )
        },
      }).render()

      // condition: a render where a previous component is reused
      includeRef.value = ['foo', 'bar']
      await nextTick()
      includeRef.value = []
      await nextTick()
      expect(unmounted).not.toHaveBeenCalled()
    })

    test('should update re-activated component if props have changed', async () => {
      const Foo = defineVaporComponent({
        props: ['n'],
        setup(props) {
          const n0 = template(`<div> </div>`)() as any
          const x0 = child(n0) as any
          renderEffect(() => setText(x0, props.n))
          return n0
        },
      })

      const toggle = ref(true)
      const n = ref(0)
      const { html } = define({
        setup() {
          return createComponent(VaporKeepAlive, null, {
            default: () => {
              return createIf(
                () => toggle.value,
                () => createComponent(Foo, { n: () => n.value }),
              )
            },
          })
        },
      }).render()

      expect(html()).toBe(`<div>0</div><!--if-->`)

      toggle.value = false
      await nextTick()
      expect(html()).toBe(`<!--if-->`)

      n.value++
      await nextTick()
      toggle.value = true
      await nextTick()
      expect(html()).toBe(`<div>1</div><!--if-->`)
    })
  })

  test('should work with async component', async () => {
    let resolve: (comp: VaporComponent) => void
    const AsyncComp = defineVaporAsyncComponent(
      () =>
        new Promise(r => {
          resolve = r as any
        }),
    )

    const toggle = ref(true)
    const instanceRef = ref<any>(null)
    const { html } = define({
      setup() {
        const setRef = createTemplateRefSetter()
        return createComponent(
          VaporKeepAlive,
          { include: () => 'Foo' },
          {
            default: () => {
              return createIf(
                () => toggle.value,
                () => {
                  const n0 = createComponent(AsyncComp)
                  setRef(n0, instanceRef)
                  return n0
                },
              )
            },
          },
        )
      },
    }).render()

    expect(html()).toBe(`<!--async component--><!--if-->`)

    resolve!(
      defineVaporComponent({
        name: 'Foo',
        setup(_, { expose }) {
          const count = ref(0)
          expose({
            inc: () => {
              count.value++
            },
          })

          const n0 = template(`<p> </p>`)() as any
          const x0 = child(n0) as any
          renderEffect(() => {
            setText(x0, String(count.value))
          })
          return n0
        },
      }),
    )

    await timeout()
    // resolved
    expect(html()).toBe(`<p>0</p><!--async component--><!--if-->`)

    // change state + toggle out
    instanceRef.value.inc()
    toggle.value = false
    await nextTick()
    expect(html()).toBe('<!--if-->')

    // toggle in, state should be maintained
    toggle.value = true
    await nextTick()
    expect(html()).toBe('<p>1</p><!--async component--><!--if-->')

    toggle.value = false
    await nextTick()
    expect(html()).toBe('<!--if-->')
  })

  test('handle error in async onActivated', async () => {
    const err = new Error('foo')
    const handler = vi.fn()
    const Child = defineVaporComponent({
      setup() {
        onActivated(async () => {
          throw err
        })

        return template(`<span></span`)()
      },
    })

    const { app } = define({
      setup() {
        return createComponent(VaporKeepAlive, null, {
          default: () => createComponent(Child),
        })
      },
    }).create()

    app.config.errorHandler = handler
    app.mount(document.createElement('div'))

    await nextTick()
    expect(handler).toHaveBeenCalledTimes(1)
  })

  test('should avoid unmount later included components', async () => {
    const unmountedA = vi.fn()
    const mountedA = vi.fn()
    const activatedA = vi.fn()
    const deactivatedA = vi.fn()
    const unmountedB = vi.fn()
    const mountedB = vi.fn()

    const A = defineVaporComponent({
      name: 'A',
      setup() {
        onMounted(mountedA)
        onUnmounted(unmountedA)
        onActivated(activatedA)
        onDeactivated(deactivatedA)
        return template(`<div>A</div>`)()
      },
    })

    const B = defineVaporComponent({
      name: 'B',
      setup() {
        onMounted(mountedB)
        onUnmounted(unmountedB)
        return template(`<div>B</div>`)()
      },
    })

    const include = reactive<string[]>([])
    const current = shallowRef(A)
    const { html } = define({
      setup() {
        return createComponent(
          VaporKeepAlive,
          { include: () => include },
          {
            default: () => createDynamicComponent(() => current.value),
          },
        )
      },
    }).render()

    expect(html()).toBe(`<div>A</div><!--dynamic-component-->`)
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
    expect(html()).toBe(`<div>B</div><!--dynamic-component-->`)
    expect(mountedA).toHaveBeenCalledTimes(1)
    expect(unmountedA).toHaveBeenCalledTimes(0)
    expect(activatedA).toHaveBeenCalledTimes(0)
    expect(deactivatedA).toHaveBeenCalledTimes(1)
    expect(mountedB).toHaveBeenCalledTimes(1)
    expect(unmountedB).toHaveBeenCalledTimes(0)
  })

  test('remove component from include then switching child', async () => {
    const About = defineVaporComponent({
      name: 'About',
      setup() {
        return template(`<h1>About</h1>`)()
      },
    })
    const mountedHome = vi.fn()
    const unmountedHome = vi.fn()
    const activatedHome = vi.fn()
    const deactivatedHome = vi.fn()

    const Home = defineVaporComponent({
      name: 'Home',
      setup() {
        onMounted(mountedHome)
        onUnmounted(unmountedHome)
        onDeactivated(deactivatedHome)
        onActivated(activatedHome)
        return template(`<h1>Home</h1>`)()
      },
    })

    const activeViewName = ref('Home')
    const cacheList = reactive(['Home'])

    define({
      setup() {
        return createComponent(
          VaporKeepAlive,
          { include: () => cacheList },
          {
            default: () => {
              return createIf(
                () => activeViewName.value === 'Home',
                () => createComponent(Home),
                () => createComponent(About),
              )
            },
          },
        )
      },
    }).render()

    expect(mountedHome).toHaveBeenCalledTimes(1)
    expect(activatedHome).toHaveBeenCalledTimes(1)
    cacheList.splice(0, 1)
    await nextTick()
    activeViewName.value = 'About'
    await nextTick()
    expect(deactivatedHome).toHaveBeenCalledTimes(0)
    expect(unmountedHome).toHaveBeenCalledTimes(1)
  })

  describe('vdom interop', () => {
    test('should work', () => {
      const VdomComp = {
        setup() {
          onBeforeMount(() => oneHooks.beforeMount())
          onMounted(() => oneHooks.mounted())
          onActivated(() => oneHooks.activated())
          onDeactivated(() => oneHooks.deactivated())
          onUnmounted(() => oneHooks.unmounted())
          return () => h('div', null, 'hi')
        },
      }

      const App = defineVaporComponent({
        setup() {
          return createComponent(VaporKeepAlive, null, {
            default: () => {
              return createComponent(VdomComp)
            },
          })
        },
      })

      const container = document.createElement('div')
      document.body.appendChild(container)
      const app = createVaporApp(App)
      app.use(vaporInteropPlugin)
      app.mount(container)

      expect(container.innerHTML).toBe(`<div>hi</div>`)
      assertHookCalls(oneHooks, [1, 1, 1, 0, 0])
    })

    test('with v-if', async () => {
      const VdomComp = {
        setup() {
          const msg = ref('vdom')
          onBeforeMount(() => oneHooks.beforeMount())
          onMounted(() => oneHooks.mounted())
          onActivated(() => oneHooks.activated())
          onDeactivated(() => oneHooks.deactivated())
          onUnmounted(() => oneHooks.unmounted())
          return () => {
            return withDirectives(
              h(
                'input',
                {
                  type: 'text',
                  'onUpdate:modelValue': ($event: any) => (msg.value = $event),
                },
                [],
              ),
              [[vModelText, msg.value]],
            )
          }
        },
      }

      const show = ref(true)
      const toggle = ref(true)

      const App = defineVaporComponent({
        setup() {
          const n0 = createIf(
            () => show.value,
            () => {
              const n5 = createComponent(
                VaporKeepAlive,
                null,
                {
                  default: () => {
                    const n2 = createIf(
                      () => toggle.value,
                      () => {
                        const n4 = createComponent(VdomComp)
                        return n4
                      },
                    )
                    return n2
                  },
                },
                true,
              )
              return n5
            },
          )
          return n0
        },
      })

      const container = document.createElement('div')
      document.body.appendChild(container)
      const app = createVaporApp(App)
      app.use(vaporInteropPlugin)
      app.mount(container)

      expect(container.innerHTML).toBe(`<input type="text"><!--if--><!--if-->`)
      assertHookCalls(oneHooks, [1, 1, 1, 0, 0])

      let inputEl = container.firstChild as HTMLInputElement
      expect(inputEl.value).toBe('vdom')

      inputEl.value = 'changed'
      inputEl.dispatchEvent(new Event('input'))
      await nextTick()

      // deactivate
      toggle.value = false
      await nextTick()
      expect(container.innerHTML).toBe(`<!--if--><!--if-->`)
      assertHookCalls(oneHooks, [1, 1, 1, 1, 0])

      // activate
      toggle.value = true
      await nextTick()
      expect(container.innerHTML).toBe(`<input type="text"><!--if--><!--if-->`)
      assertHookCalls(oneHooks, [1, 1, 2, 1, 0])
      expect(inputEl.value).toBe('changed')

      // unmount keepalive
      show.value = false
      await nextTick()
      expect(container.innerHTML).toBe(`<!--if-->`)
      assertHookCalls(oneHooks, [1, 1, 2, 2, 1])

      // mount keepalive
      show.value = true
      await nextTick()
      expect(container.innerHTML).toBe(`<input type="text"><!--if--><!--if-->`)
      assertHookCalls(oneHooks, [2, 2, 3, 2, 1])
      inputEl = container.firstChild as HTMLInputElement
      expect(inputEl.value).toBe('vdom')
    })
  })
})
