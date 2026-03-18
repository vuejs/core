import {
  defineAsyncComponent,
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
import { VaporKeepAlive } from '../../src/components/KeepAlive'
import {
  child,
  createComponent,
  createDynamicComponent,
  createIf,
  createSlot,
  createTemplateRefSetter,
  createVaporApp,
  defineVaporAsyncComponent,
  defineVaporComponent,
  renderEffect,
  setText,
  template,
  vaporInteropPlugin,
  withVaporCtx,
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

  test('should cache same component across branches', async () => {
    const toggle = ref(true)
    const instanceA = ref<any>(null)
    const instanceB = ref<any>(null)

    const { html } = define({
      setup() {
        const setRefA = createTemplateRefSetter()
        const setRefB = createTemplateRefSetter()
        return createComponent(VaporKeepAlive, null, {
          default: () =>
            createIf(
              () => toggle.value,
              () => {
                const n0 = createComponent(one)
                setRefA(n0, instanceA)
                return n0
              },
              () => {
                const n1 = createComponent(one)
                setRefB(n1, instanceB)
                return n1
              },
              undefined,
              undefined,
              0,
            ),
        })
      },
    }).render()

    expect(html()).toBe(`<div>one</div><!--if-->`)

    instanceA.value.setMsg('A')
    await nextTick()
    expect(html()).toBe(`<div>A</div><!--if-->`)

    toggle.value = false
    await nextTick()
    expect(html()).toBe(`<div>one</div><!--if-->`)

    instanceB.value.setMsg('B')
    await nextTick()
    expect(html()).toBe(`<div>B</div><!--if-->`)

    toggle.value = true
    await nextTick()
    expect(html()).toBe(`<div>A</div><!--if-->`)
  })

  test('should cache same component across branches with reusable keep-alive', async () => {
    const toggle = ref(true)
    const instanceA = ref<any>(null)
    const instanceB = ref<any>(null)

    const Comp = defineVaporComponent({
      setup() {
        return createComponent(VaporKeepAlive, null, {
          default: withVaporCtx(() => {
            const n0 = createSlot('default', null)
            return n0
          }),
        })
      },
    })

    const { html } = define({
      setup() {
        const setRefA = createTemplateRefSetter()
        const setRefB = createTemplateRefSetter()
        return createComponent(Comp, null, {
          default: () =>
            createIf(
              () => toggle.value,
              () => {
                const n0 = createComponent(one)
                setRefA(n0, instanceA)
                return n0
              },
              () => {
                const n1 = createComponent(one)
                setRefB(n1, instanceB)
                return n1
              },
              undefined,
              undefined,
              0,
            ),
        })
      },
    }).render()

    expect(html()).toBe(`<div>one</div><!--if--><!--slot-->`)

    instanceA.value.setMsg('A')
    await nextTick()
    expect(html()).toBe(`<div>A</div><!--if--><!--slot-->`)

    toggle.value = false
    await nextTick()
    expect(html()).toBe(`<div>one</div><!--if--><!--slot-->`)

    instanceB.value.setMsg('B')
    await nextTick()
    expect(html()).toBe(`<div>B</div><!--if--><!--slot-->`)

    toggle.value = true
    await nextTick()
    expect(html()).toBe(`<div>A</div><!--if--><!--slot-->`)
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

  test('should cache components in nested DynamicFragment (v-if > dynamic component)', async () => {
    const outerIf = ref(true)
    const viewRef = ref('one')

    const { html } = define({
      setup() {
        return createComponent(VaporKeepAlive, null, {
          default: () =>
            createIf(
              () => outerIf.value,
              () => createDynamicComponent(() => views[viewRef.value]),
            ),
        })
      },
    }).render()

    expect(html()).toBe(`<div>one</div><!--dynamic-component--><!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 1, 0, 0])
    assertHookCalls(twoHooks, [0, 0, 0, 0, 0])

    viewRef.value = 'two'
    await nextTick()
    expect(html()).toBe(`<div>two</div><!--dynamic-component--><!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 1, 1, 0])
    assertHookCalls(twoHooks, [1, 1, 1, 0, 0])

    viewRef.value = 'one'
    await nextTick()
    expect(html()).toBe(`<div>one</div><!--dynamic-component--><!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 2, 1, 0])
    assertHookCalls(twoHooks, [1, 1, 1, 1, 0])

    // Toggle v-if off
    outerIf.value = false
    await nextTick()
    expect(html()).toBe(`<!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 2, 2, 0])
    assertHookCalls(twoHooks, [1, 1, 1, 1, 0])

    // Toggle v-if back on
    outerIf.value = true
    await nextTick()
    expect(html()).toBe(`<div>one</div><!--dynamic-component--><!--if-->`)
    // one should be reactivated from cache
    assertHookCalls(oneHooks, [1, 1, 3, 2, 0])
    assertHookCalls(twoHooks, [1, 1, 1, 1, 0])
  })

  test('should cache components in nested DynamicFragment with initial false v-if', async () => {
    const outerIf = ref(false)
    const viewRef = ref('one')

    const { html } = define({
      setup() {
        return createComponent(VaporKeepAlive, null, {
          default: () =>
            createIf(
              () => outerIf.value,
              () => createDynamicComponent(() => views[viewRef.value]),
            ),
        })
      },
    }).render()

    // Initially v-if is false, nothing rendered
    expect(html()).toBe(`<!--if-->`)
    assertHookCalls(oneHooks, [0, 0, 0, 0, 0])
    assertHookCalls(twoHooks, [0, 0, 0, 0, 0])

    // Toggle v-if on - component should mount and activate
    outerIf.value = true
    await nextTick()
    expect(html()).toBe(`<div>one</div><!--dynamic-component--><!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 1, 0, 0])
    assertHookCalls(twoHooks, [0, 0, 0, 0, 0])

    // Switch to component two
    viewRef.value = 'two'
    await nextTick()
    expect(html()).toBe(`<div>two</div><!--dynamic-component--><!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 1, 1, 0])
    assertHookCalls(twoHooks, [1, 1, 1, 0, 0])

    // Switch back to one - should be reactivated from cache
    viewRef.value = 'one'
    await nextTick()
    expect(html()).toBe(`<div>one</div><!--dynamic-component--><!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 2, 1, 0])
    assertHookCalls(twoHooks, [1, 1, 1, 1, 0])

    // Toggle v-if off
    outerIf.value = false
    await nextTick()
    expect(html()).toBe(`<!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 2, 2, 0])
    assertHookCalls(twoHooks, [1, 1, 1, 1, 0])

    // Toggle v-if back on - should reactivate from cache
    outerIf.value = true
    await nextTick()
    expect(html()).toBe(`<div>one</div><!--dynamic-component--><!--if-->`)
    assertHookCalls(oneHooks, [1, 1, 3, 2, 0])
    assertHookCalls(twoHooks, [1, 1, 1, 1, 0])
  })

  test('should cache async components in nested v-if', async () => {
    const asyncOneHooks = {
      mounted: vi.fn(),
      activated: vi.fn(),
      deactivated: vi.fn(),
      unmounted: vi.fn(),
    }

    const AsyncOne = defineVaporAsyncComponent({
      loader: () =>
        Promise.resolve(
          defineVaporComponent({
            name: 'AsyncOne',
            setup() {
              onMounted(asyncOneHooks.mounted)
              onActivated(asyncOneHooks.activated)
              onDeactivated(asyncOneHooks.deactivated)
              onUnmounted(asyncOneHooks.unmounted)
              return template('<div>async one</div>')()
            },
          }),
        ),
    })

    const outerIf = ref(true)

    const { html } = define({
      setup() {
        return createComponent(VaporKeepAlive, null, {
          default: () =>
            createIf(
              () => outerIf.value,
              () => createComponent(AsyncOne),
            ),
        })
      },
    }).render()

    await timeout()
    await nextTick()
    expect(html()).toBe('<div>async one</div><!--async component--><!--if-->')
    expect(asyncOneHooks.mounted).toHaveBeenCalledTimes(1)
    expect(asyncOneHooks.activated).toHaveBeenCalledTimes(1)

    // Toggle v-if off - should deactivate, not unmount
    outerIf.value = false
    await nextTick()
    expect(html()).toBe('<!--if-->')
    expect(asyncOneHooks.deactivated).toHaveBeenCalledTimes(1)
    expect(asyncOneHooks.unmounted).toHaveBeenCalledTimes(0)

    // Toggle back on - should reactivate from cache
    outerIf.value = true
    await nextTick()
    expect(html()).toBe('<div>async one</div><!--async component--><!--if-->')
    expect(asyncOneHooks.activated).toHaveBeenCalledTimes(2)
    expect(asyncOneHooks.mounted).toHaveBeenCalledTimes(1) // not re-mounted
  })

  test('should cache components in deeply nested v-if (v-if > v-if > component)', async () => {
    const compHooks = {
      mounted: vi.fn(),
      activated: vi.fn(),
      deactivated: vi.fn(),
      unmounted: vi.fn(),
    }

    const Comp = defineVaporComponent({
      name: 'Comp',
      setup() {
        onMounted(compHooks.mounted)
        onActivated(compHooks.activated)
        onDeactivated(compHooks.deactivated)
        onUnmounted(compHooks.unmounted)
        return template('<div>comp</div>')()
      },
    })

    const outerIf = ref(true)
    const innerIf = ref(true)

    const { html } = define({
      setup() {
        return createComponent(VaporKeepAlive, null, {
          default: () =>
            createIf(
              () => outerIf.value,
              () =>
                createIf(
                  () => innerIf.value,
                  () => createComponent(Comp),
                ),
            ),
        })
      },
    }).render()

    expect(html()).toBe('<div>comp</div><!--if--><!--if-->')
    expect(compHooks.mounted).toHaveBeenCalledTimes(1)
    expect(compHooks.activated).toHaveBeenCalledTimes(1)

    // Toggle inner v-if off
    innerIf.value = false
    await nextTick()
    expect(html()).toBe('<!--if--><!--if-->')
    expect(compHooks.deactivated).toHaveBeenCalledTimes(1)
    expect(compHooks.unmounted).toHaveBeenCalledTimes(0)

    // Toggle inner v-if back on - should reactivate
    innerIf.value = true
    await nextTick()
    expect(html()).toBe('<div>comp</div><!--if--><!--if-->')
    expect(compHooks.activated).toHaveBeenCalledTimes(2)
    expect(compHooks.mounted).toHaveBeenCalledTimes(1)

    // Toggle outer v-if off
    outerIf.value = false
    await nextTick()
    expect(html()).toBe('<!--if-->')
    expect(compHooks.deactivated).toHaveBeenCalledTimes(2)
    expect(compHooks.unmounted).toHaveBeenCalledTimes(0)

    // Toggle outer v-if back on - should reactivate
    outerIf.value = true
    await nextTick()
    expect(html()).toBe('<div>comp</div><!--if--><!--if-->')
    expect(compHooks.activated).toHaveBeenCalledTimes(3)
    expect(compHooks.mounted).toHaveBeenCalledTimes(1)
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

  test('should not cache async component when resolved name does not match include', async () => {
    let resolve: (comp: VaporComponent) => void
    const AsyncComp = defineVaporAsyncComponent(
      () =>
        new Promise(r => {
          resolve = r as any
        }),
    )

    const mounted = vi.fn()
    const unmounted = vi.fn()
    const activated = vi.fn()
    const deactivated = vi.fn()

    const toggle = ref(true)
    const { html } = define({
      setup() {
        return createComponent(
          VaporKeepAlive,
          // include only 'SomeOtherName', not 'Bar'
          { include: () => 'SomeOtherName' },
          {
            default: () => {
              return createIf(
                () => toggle.value,
                () => createComponent(AsyncComp),
              )
            },
          },
        )
      },
    }).render()

    expect(html()).toBe(`<!--async component--><!--if-->`)

    // Resolve with name 'Bar' which doesn't match include 'SomeOtherName'
    resolve!(
      defineVaporComponent({
        name: 'Bar',
        setup() {
          onMounted(mounted)
          onUnmounted(unmounted)
          onActivated(activated)
          onDeactivated(deactivated)
          return template(`<div>Bar</div>`)()
        },
      }),
    )

    await timeout()
    expect(html()).toBe(`<div>Bar</div><!--async component--><!--if-->`)
    expect(mounted).toHaveBeenCalledTimes(1)
    // Should NOT call activated because it doesn't match include
    expect(activated).toHaveBeenCalledTimes(0)

    // Toggle off - should unmount, NOT deactivate (because not cached)
    toggle.value = false
    await nextTick()
    expect(html()).toBe('<!--if-->')
    expect(unmounted).toHaveBeenCalledTimes(1)
    expect(deactivated).toHaveBeenCalledTimes(0)

    // Toggle on - should remount, NOT activate from cache
    toggle.value = true
    await nextTick()
    expect(html()).toBe(`<div>Bar</div><!--async component--><!--if-->`)
    expect(mounted).toHaveBeenCalledTimes(2) // Should be called again
    expect(activated).toHaveBeenCalledTimes(0)
  })

  test('should not prune cached async component when its resolved name still matches include', async () => {
    let resolve: (comp: VaporComponent) => void
    const AsyncComp = defineVaporAsyncComponent(
      () =>
        new Promise(r => {
          resolve = r as any
        }),
    )

    const include = ref('Foo')
    const toggle = ref(true)
    const { html, instance } = define({
      setup() {
        return createComponent(
          VaporKeepAlive,
          { include: () => include.value },
          {
            default: () => {
              return createIf(
                () => toggle.value,
                () => createComponent(AsyncComp),
              )
            },
          },
        )
      },
    }).render()

    resolve!(
      defineVaporComponent({
        name: 'Foo',
        setup() {
          return template(`<div>Foo</div>`)()
        },
      }),
    )
    await timeout()
    expect(html()).toBe(`<div>Foo</div><!--async component--><!--if-->`)

    toggle.value = false
    await nextTick()
    expect(html()).toBe('<!--if-->')

    const keepAliveInstance = instance!.block as any
    const cache = keepAliveInstance.__v_cache as Map<any, any>
    expect(cache.size).toBe(1)

    include.value = 'Foo,Bar'
    await nextTick()
    expect(cache.size).toBe(1)
  })

  test('should prune cached async component when its resolved name no longer matches include', async () => {
    let resolve: (comp: VaporComponent) => void
    const AsyncComp = defineVaporAsyncComponent(
      () =>
        new Promise(r => {
          resolve = r as any
        }),
    )

    const include = ref('Foo')
    const toggle = ref(true)
    const { html, instance } = define({
      setup() {
        return createComponent(
          VaporKeepAlive,
          { include: () => include.value },
          {
            default: () => {
              return createIf(
                () => toggle.value,
                () => createComponent(AsyncComp),
              )
            },
          },
        )
      },
    }).render()

    resolve!(
      defineVaporComponent({
        name: 'Foo',
        setup() {
          return template(`<div>Foo</div>`)()
        },
      }),
    )
    await timeout()
    expect(html()).toBe(`<div>Foo</div><!--async component--><!--if-->`)

    toggle.value = false
    await nextTick()
    expect(html()).toBe('<!--if-->')

    const keepAliveInstance = instance!.block as any
    const cache = keepAliveInstance.__v_cache as Map<any, any>
    expect(cache.size).toBe(1)

    // 'Foo' no longer matches include 'Bar', should be pruned
    include.value = 'Bar'
    await nextTick()
    expect(cache.size).toBe(0)
  })

  test('should stop branch scope when cache entry is pruned', async () => {
    const One = defineVaporComponent({
      name: 'One',
      setup() {
        return template('<div>one</div>')()
      },
    })

    const Two = defineVaporComponent({
      name: 'Two',
      setup() {
        return template('<div>two</div>')()
      },
    })

    const include = ref('One,Two')
    const toggle = ref(true)
    const { html, instance } = define({
      setup() {
        return createComponent(
          VaporKeepAlive,
          { include: () => include.value },
          {
            default: () =>
              createIf(
                () => toggle.value,
                () => createComponent(One),
                () => createComponent(Two),
              ),
          },
        )
      },
    }).render()

    const keepAliveInstance = instance!.block as any
    const keptAliveScopes = keepAliveInstance.__v_keptAliveScopes as Map<
      any,
      any
    >

    expect(html()).toBe('<div>one</div><!--if-->')

    // deactivate One → branch scope retained in keptAliveScopes
    toggle.value = false
    await nextTick()
    expect(html()).toBe('<div>two</div><!--if-->')
    expect(keptAliveScopes.size).toBe(2)

    // prune One from cache → keptAliveScopes should also be cleaned up
    include.value = 'Two'
    await nextTick()
    expect(keptAliveScopes.size).toBe(0)
  })

  test('should stop branch scope when cache entry is pruned (keyed branches)', async () => {
    const Comp = defineVaporComponent({
      name: 'Comp',
      props: ['id'],
      setup(props: any) {
        return template('<div></div>')()
      },
    })

    const exclude = ref('')
    const toggle = ref(true)
    const { html, instance } = define({
      setup() {
        return createComponent(
          VaporKeepAlive,
          { exclude: () => exclude.value },
          {
            default: () =>
              // index=0 makes this a keyed DynamicFragment
              createIf(
                () => toggle.value,
                () => createComponent(Comp, { id: () => 'a' }),
                () => createComponent(Comp, { id: () => 'b' }),
                undefined,
                undefined,
                0,
              ),
          },
        )
      },
    }).render()

    const keepAliveInstance = instance!.block as any
    const cache = keepAliveInstance.__v_cache as Map<any, any>
    const keptAliveScopes = keepAliveInstance.__v_keptAliveScopes as Map<
      any,
      any
    >

    expect(html()).toBe('<div></div><!--if-->')

    // switch from branch A to branch B
    toggle.value = false
    await nextTick()

    // both branches should be independently cached
    // keyed branches use branchKey to distinguish same-type components
    expect(cache.size).toBe(2)
    expect(keptAliveScopes.size).toBe(2)

    // switch back to branch A
    toggle.value = true
    await nextTick()
    expect(cache.size).toBe(2)

    // prune by excluding Comp — all entries should be cleaned
    exclude.value = 'Comp'
    await nextTick()
    expect(cache.size).toBe(0)
    expect(keptAliveScopes.size).toBe(0)
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

    test('should cache interop async component and match by resolved name', async () => {
      const timeout = (n: number = 0) => new Promise(r => setTimeout(r, n))

      const InnerComp = {
        name: 'InnerComp',
        setup() {
          onActivated(() => oneHooks.activated())
          onDeactivated(() => oneHooks.deactivated())
          return () => h('div', 'async inner')
        },
      }

      const AsyncComp = defineAsyncComponent(
        () =>
          new Promise(resolve =>
            setTimeout(() => resolve(InnerComp as any), 0),
          ),
      )

      const include = ref('InnerComp')
      const toggle = ref(true)
      let cache: Map<any, any>

      const App = defineVaporComponent({
        setup() {
          const ka = createComponent(
            VaporKeepAlive,
            { include: () => include.value },
            {
              default: () =>
                createIf(
                  () => toggle.value,
                  () => createComponent(AsyncComp as any),
                ),
            },
          )
          cache = (ka as any).__v_cache
          return ka
        },
      })

      const container = document.createElement('div')
      document.body.appendChild(container)
      const app = createVaporApp(App)
      app.use(vaporInteropPlugin)
      app.mount(container)

      // wait for async component to resolve
      await timeout()
      await nextTick()
      await nextTick()

      expect(container.innerHTML).toContain('async inner')

      // deactivate — should be cached since resolved name matches include
      toggle.value = false
      await nextTick()
      expect(cache!.size).toBe(1)

      // change include — resolved name still matches
      include.value = 'InnerComp'
      await nextTick()
      expect(cache!.size).toBe(1)

      // change include to exclude — should prune by resolved name
      include.value = 'OtherComp'
      await nextTick()
      expect(cache!.size).toBe(0)
    })

    test('should not crash when toggling off interop async before resolve', async () => {
      const timeout = (n: number = 0) => new Promise(r => setTimeout(r, n))

      let resolve: (comp: any) => void
      const AsyncComp = defineAsyncComponent(
        () =>
          new Promise(r => {
            resolve = r
          }),
      )

      const InnerComp = {
        name: 'InnerComp',
        setup() {
          return () => h('div', 'async inner')
        },
      }

      const include = ref('InnerComp')
      const toggle = ref(true)

      const App = defineVaporComponent({
        setup() {
          return createComponent(
            VaporKeepAlive,
            { include: () => include.value },
            {
              default: () =>
                createIf(
                  () => toggle.value,
                  () => createComponent(AsyncComp as any),
                ),
            },
          )
        },
      })

      const container = document.createElement('div')
      document.body.appendChild(container)
      const app = createVaporApp(App)
      app.use(vaporInteropPlugin)
      app.mount(container)

      // toggle off BEFORE async resolves
      toggle.value = false
      await nextTick()

      // resolve async component while toggled off
      resolve!(InnerComp)
      await timeout()
      await nextTick()

      // toggle back on — should remount fresh (not cached since was unresolved)
      toggle.value = true
      await nextTick()
      await timeout()
      await nextTick()

      expect(container.innerHTML).toContain('async inner')
    })

    test('should not mis-cache when interop async resolves after switching away', async () => {
      const timeout = (n: number = 0) => new Promise(r => setTimeout(r, n))

      let resolveA: (comp: any) => void
      const AsyncCompA = defineAsyncComponent(
        () =>
          new Promise(r => {
            resolveA = r
          }),
      )

      const InnerCompA = {
        name: 'CompA',
        setup() {
          return () => h('div', 'comp A')
        },
      }

      const CompB = {
        name: 'CompB',
        setup() {
          return () => h('div', 'comp B')
        },
      }

      const showA = ref(true)
      let cache: Map<any, any>

      const App = defineVaporComponent({
        setup() {
          const ka = createComponent(VaporKeepAlive, null, {
            default: () =>
              createIf(
                () => showA.value,
                () => createComponent(AsyncCompA as any),
                () => createComponent(CompB),
              ),
          })
          cache = (ka as any).__v_cache
          return ka
        },
      })

      const container = document.createElement('div')
      document.body.appendChild(container)
      const app = createVaporApp(App)
      app.use(vaporInteropPlugin)
      app.mount(container)

      // switch to CompB before AsyncCompA resolves
      showA.value = false
      await nextTick()
      expect(container.innerHTML).toContain('comp B')

      const cacheBeforeResolve = cache!.size

      // resolve A after switching away — should NOT trigger mis-cache
      resolveA!(InnerCompA)
      await timeout()
      await nextTick()

      // cache should not have grown from the stale resolution
      expect(cache!.size).toBe(cacheBeforeResolve)
    })
  })

  test('should invalidate pending mount/activated hooks when deactivated before post flush', async () => {
    const mountedSpy = vi.fn()
    const activatedSpy = vi.fn()

    const show = ref(false)

    const Child = defineVaporComponent({
      name: 'Child',
      setup() {
        onBeforeMount(() => {
          show.value = false
        })
        onMounted(mountedSpy)
        onActivated(activatedSpy)
        return template('<div>child</div>')()
      },
    })

    define({
      setup() {
        return createComponent(VaporKeepAlive, null, {
          default: () =>
            createIf(
              () => show.value,
              () => createComponent(Child),
            ),
        })
      },
    }).render()

    expect(mountedSpy).toHaveBeenCalledTimes(0)
    expect(activatedSpy).toHaveBeenCalledTimes(0)

    show.value = true
    await nextTick()

    expect(mountedSpy).toHaveBeenCalledTimes(0)
    expect(activatedSpy).toHaveBeenCalledTimes(0)
  })

  test('should clear template ref when switching to unresolved async component', async () => {
    const timeout = (n: number = 0) => new Promise(r => setTimeout(r, n))

    let resolveAsync: (comp: any) => void
    const AsyncComp = defineVaporAsyncComponent(
      () =>
        new Promise(r => {
          resolveAsync = r
        }),
    )

    const Comp = defineVaporComponent({
      name: 'Comp',
      setup() {
        return template('<div>comp</div>')()
      },
    })

    const instanceRef = ref<any>(null)
    const toggle = ref(false)

    define({
      setup() {
        const setRef = createTemplateRefSetter()
        return createComponent(VaporKeepAlive, null, {
          default: () =>
            createIf(
              () => toggle.value,
              () => {
                const comp = createComponent(AsyncComp)
                setRef(comp, instanceRef)
                return comp
              },
              () => {
                const comp = createComponent(Comp)
                setRef(comp, instanceRef)
                return comp
              },
            ),
        })
      },
    }).render()

    await nextTick()
    // Comp is mounted — ref should point to it
    expect(instanceRef.value).not.toBe(null)

    // switch to async component (unresolved)
    toggle.value = true
    await nextTick()
    // ref should be null while async is pending
    expect(instanceRef.value).toBe(null)

    // resolve async
    resolveAsync!(
      defineVaporComponent({
        name: 'AsyncResolved',
        setup() {
          return template('<div>async</div>')()
        },
      }),
    )
    await timeout()
    await nextTick()
    // ref should now point to the resolved component
    expect(instanceRef.value).not.toBe(null)

    // switch back to Comp
    toggle.value = false
    await nextTick()
    expect(instanceRef.value).not.toBe(null)
  })

  test('should clear old ref when switching KeepAlive branches', async () => {
    const CompA = defineVaporComponent({
      name: 'CompA',
      setup() {
        return template('<div>A</div>')()
      },
    })

    const CompB = defineVaporComponent({
      name: 'CompB',
      setup() {
        return template('<div>B</div>')()
      },
    })

    const refA = ref<any>(null)
    const refB = ref<any>(null)
    const toggle = ref(true)

    define({
      setup() {
        const setRef = createTemplateRefSetter()
        return createComponent(VaporKeepAlive, null, {
          default: () =>
            createIf(
              () => toggle.value,
              () => {
                const comp = createComponent(CompA)
                setRef(comp, refA)
                return comp
              },
              () => {
                const comp = createComponent(CompB)
                setRef(comp, refB)
                return comp
              },
            ),
        })
      },
    }).render()

    await nextTick()
    expect(refA.value).not.toBe(null)
    expect(refB.value).toBe(null)

    // switch to CompB — refA should be cleared
    toggle.value = false
    await nextTick()
    expect(refB.value).not.toBe(null)
    expect(refA.value).toBe(null)

    // switch back to CompA — refB should be cleared
    toggle.value = true
    await nextTick()
    expect(refA.value).not.toBe(null)
    expect(refB.value).toBe(null)
  })
})
