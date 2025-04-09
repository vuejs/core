import {
  nextTick,
  onActivated,
  onBeforeMount,
  onDeactivated,
  onMounted,
  onUnmounted,
  ref,
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
  defineVaporComponent,
  renderEffect,
  setText,
  template,
} from '../../src'

const define = makeRender()

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
  })
})
