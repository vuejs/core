import {
  Fragment,
  Suspense,
  Teleport,
  cloneVNode,
  createApp,
  h,
  nextTick,
  onUpdated,
  ref,
  renderSlot,
} from '@vue/runtime-dom'
import { VaporDynamicComponentFlags, VaporSlotFlags } from '@vue/shared'
import { BindingTypes } from '@vue/compiler-dom'
import {
  VaporTeleport,
  VaporTransition,
  createComponent,
  createDynamicComponent,
  createFor,
  createIf,
  createSlot,
  createVaporApp,
  defineVaporAsyncComponent,
  defineVaporComponent,
  setInsertionState,
  template,
  vaporInteropPlugin,
} from '../src'
import { compile, compileToVaporRender, makeRender } from './_utils'

const define = makeRender()

describe('scopeId', () => {
  test('should attach scopeId to child component', () => {
    const Child = defineVaporComponent({
      __scopeId: 'child',
      setup() {
        return template('<div child></div>', 1)()
      },
    })
    const { html } = define({
      __scopeId: 'parent',
      setup() {
        return createComponent(Child)
      },
    }).render()
    expect(html()).toBe(`<div child="" parent=""></div>`)
  })

  test('should attach scopeId to updated dynamic child component root', async () => {
    const showAlt = ref(false)
    const Child = defineVaporComponent({
      __scopeId: 'child',
      render: compileToVaporRender(
        `<section v-if="showAlt">alt</section><div v-else>base</div>`,
        {
          bindingMetadata: {
            showAlt: BindingTypes.SETUP_REF,
          },
          scopeId: 'child',
        },
      ),
      setup() {
        return { showAlt }
      },
    })

    const { html } = define({
      __scopeId: 'parent',
      setup() {
        return createComponent(Child)
      },
    }).render()

    expect(html()).toBe(`<div child="" parent="">base</div><!--if-->`)

    showAlt.value = true
    await nextTick()

    expect(html()).toBe(`<section child="" parent="">alt</section><!--if-->`)
  })

  test('should attach scopeId to child component with insertion state', () => {
    const Child = defineVaporComponent({
      __scopeId: 'child',
      setup() {
        return template('<div child></div>', 1)()
      },
    })

    const { html } = define({
      __scopeId: 'parent',
      setup() {
        const t0 = template('<div parent></div>', 1)
        const n1 = t0() as any
        setInsertionState(n1)
        createComponent(Child)
        return n1
      },
    }).render()
    expect(html()).toBe(`<div parent=""><div child="" parent=""></div></div>`)
  })

  test('should attach scopeId to nested child component', () => {
    const Child = defineVaporComponent({
      __scopeId: 'child',
      setup() {
        return template('<div child></div>', 1)()
      },
    })

    const Parent = defineVaporComponent({
      __scopeId: 'parent',
      setup() {
        return createComponent(Child)
      },
    })

    const { html } = define({
      __scopeId: 'app',
      setup() {
        return createComponent(Parent)
      },
    }).render()
    expect(html()).toBe(`<div child="" parent="" app=""></div>`)
  })

  test('should not attach scopeId to nested multiple root components', async () => {
    const show = ref(false)
    const Child = defineVaporComponent({
      __scopeId: 'child',
      setup() {
        return template('<div child></div>', 1)()
      },
    })

    const Parent = defineVaporComponent({
      __scopeId: 'parent',
      setup() {
        const n0 = template('<div parent></div>')()
        const n1 = createIf(
          () => show.value,
          () => template('<span parent></span>', 1)(),
        )
        const n2 = createComponent(Child)
        return [n0, n1, n2]
      },
    })

    const { html } = define({
      __scopeId: 'app',
      setup() {
        return createComponent(Parent)
      },
    }).render()
    expect(html()).toBe(
      `<div parent=""></div><!--if--><div child="" parent=""></div>`,
    )

    show.value = true
    await nextTick()

    expect(html()).toBe(
      `<div parent=""></div><span parent=""></span><!--if--><div child="" parent=""></div>`,
    )
  })

  test('should attach scopeId to nested child component with insertion state', () => {
    const Child = defineVaporComponent({
      __scopeId: 'child',
      setup() {
        return template('<div child></div>', 1)()
      },
    })

    const Parent = defineVaporComponent({
      __scopeId: 'parent',
      setup() {
        return createComponent(Child)
      },
    })

    const { html } = define({
      __scopeId: 'app',
      setup() {
        const t0 = template('<div app></div>', 1)
        const n1 = t0() as any
        setInsertionState(n1)
        createComponent(Parent)
        return n1
      },
    }).render()
    expect(html()).toBe(
      `<div app=""><div child="" parent="" app=""></div></div>`,
    )
  })

  test('should attach scopeId to dynamic component', () => {
    const { html } = define({
      __scopeId: 'parent',
      setup() {
        return createDynamicComponent(() => 'button')
      },
    }).render()
    expect(html()).toBe(`<button parent=""></button><!--dynamic-component-->`)
  })

  test('should attach scopeId to dynamic component with insertion state', () => {
    const { html } = define({
      __scopeId: 'parent',
      setup() {
        const t0 = template('<div parent></div>', 1)
        const n1 = t0() as any
        setInsertionState(n1)
        createDynamicComponent(() => 'button')
        return n1
      },
    }).render()
    expect(html()).toBe(
      `<div parent=""><button parent=""></button><!--dynamic-component--></div>`,
    )
  })

  test('should attach scopeId to nested dynamic component', () => {
    const Comp = defineVaporComponent({
      __scopeId: 'child',
      setup() {
        return createDynamicComponent(
          () => 'button',
          null,
          null,
          VaporDynamicComponentFlags.SINGLE_ROOT,
        )
      },
    })
    const { html } = define({
      __scopeId: 'parent',
      setup() {
        return createComponent(Comp, null, null, true)
      },
    }).render()
    expect(html()).toBe(
      `<button child="" parent=""></button><!--dynamic-component-->`,
    )
  })

  test('should attach scopeId to nested dynamic component with insertion state', () => {
    const Comp = defineVaporComponent({
      __scopeId: 'child',
      setup() {
        return createDynamicComponent(
          () => 'button',
          null,
          null,
          VaporDynamicComponentFlags.SINGLE_ROOT,
        )
      },
    })
    const { html } = define({
      __scopeId: 'parent',
      setup() {
        const t0 = template('<div parent></div>', 1)
        const n1 = t0() as any
        setInsertionState(n1)
        createComponent(Comp, null, null, true)
        return n1
      },
    }).render()
    expect(html()).toBe(
      `<div parent=""><button child="" parent=""></button><!--dynamic-component--></div>`,
    )
  })

  test.todo('should attach scopeId to suspense content', async () => {})

  // :slotted basic
  test('should work on slots', () => {
    const Child = defineVaporComponent({
      __scopeId: 'child',
      setup() {
        const n1 = template('<div child></div>', 1)() as any
        setInsertionState(n1)
        createSlot('default', null)
        return n1
      },
    })

    const Child2 = defineVaporComponent({
      __scopeId: 'child2',
      setup() {
        return template('<span child2></span>', 1)()
      },
    })

    const { html } = define({
      __scopeId: 'parent',
      setup() {
        const n2 = createComponent(
          Child,
          null,
          {
            default: () => {
              const n0 = template('<div parent></div>')()
              const n1 = createComponent(Child2)
              return [n0, n1]
            },
          },
          true,
        )
        return n2
      },
    }).render()

    // slot content should have:
    // - scopeId from parent
    // - slotted scopeId (with `-s` postfix) from child (the tree owner)
    expect(html()).toBe(
      `<div child="" parent="">` +
        `<div parent="" child-s=""></div>` +
        // component inside slot should have:
        // - scopeId from template context
        // - slotted scopeId from slot owner
        // - its own scopeId
        `<span child2="" parent="" child-s=""></span>` +
        `<!--slot-->` +
        `</div>`,
    )
  })

  test(':slotted on forwarded slots', async () => {
    const Wrapper = defineVaporComponent({
      __scopeId: 'wrapper',
      setup() {
        // <div><slot/></div>
        const n1 = template('<div wrapper></div>', 1)() as any
        setInsertionState(n1)
        createSlot('default', null, undefined, VaporSlotFlags.NO_SLOTTED)
        return n1
      },
    })

    const Slotted = defineVaporComponent({
      __scopeId: 'slotted',
      setup() {
        // <Wrapper><slot/></Wrapper>
        const n1 = createComponent(
          Wrapper,
          null,
          {
            default: () => {
              const n0 = createSlot('default', null)
              return n0
            },
          },
          true,
        )
        return n1
      },
    })

    const { html } = define({
      __scopeId: 'root',
      setup() {
        // <Slotted><div></div></Slotted>
        const n2 = createComponent(
          Slotted,
          null,
          {
            default: () => {
              return template('<div root></div>')()
            },
          },
          true,
        )
        return n2
      },
    }).render()

    expect(html()).toBe(
      `<div wrapper="" slotted="" root="">` +
        `<div root="" slotted-s=""></div>` +
        `<!--slot--><!--slot-->` +
        `</div>`,
    )
  })

  test(':slotted on dynamic slot outlet update', async () => {
    const data = ref({ slotName: 'missing' })
    const Child = compile(
      `<template><slot :name="data.slotName"><span>fallback</span></slot></template>`,
      data,
    )
    Child.__scopeId = 'child'

    const Parent = compile(
      `<template>
        <components.Child>
          <template #one><div>one</div></template>
          <template #two><section>two</section></template>
        </components.Child>
      </template>`,
      data,
      { Child },
    )

    const { app, html } = define(Parent).render()
    const setAttribute = vi.spyOn(Element.prototype, 'setAttribute')

    try {
      expect(html()).toBe(`<span child-s="">fallback</span><!--slot-->`)

      data.value = { slotName: 'one' }
      await nextTick()

      expect(html()).toBe(`<div child-s="">one</div><!--slot-->`)
      expect(
        setAttribute.mock.calls.filter(([name]) => name === 'child-s'),
      ).toHaveLength(1)

      data.value = { slotName: 'two' }
      await nextTick()

      expect(html()).toBe(`<section child-s="">two</section><!--slot-->`)
      expect(
        setAttribute.mock.calls.filter(([name]) => name === 'child-s'),
      ).toHaveLength(2)
    } finally {
      setAttribute.mockRestore()
      app.unmount()
    }
  })

  test(':slotted on v-for content added after mount', async () => {
    const count = ref(0)
    const Child = compile(`<template><slot /></template>`, count)
    Child.__scopeId = 'child'

    const Parent = compile(
      `<template>
        <components.Child>
          <div v-for="i in data">item</div>
        </components.Child>
      </template>`,
      count,
      { Child },
    )

    const { html } = define(Parent).render()

    expect(html()).toBe(`<!--for--><!--slot-->`)

    count.value++
    await nextTick()

    expect(html()).toBe(`<div child-s="">item</div><!--for--><!--slot-->`)

    count.value++
    await nextTick()

    expect(html()).toBe(
      `<div child-s="">item</div><div child-s="">item</div><!--for--><!--slot-->`,
    )
  })

  test(':slotted on v-for content inside v-if added after mount', async () => {
    const data = ref({ show: false, count: 1 })
    const Child = compile(`<template><slot /></template>`, data)
    Child.__scopeId = 'child'

    const Parent = compile(
      `<template>
        <components.Child>
          <template v-if="data.show">
            <div v-for="i in data.count">item</div>
          </template>
        </components.Child>
      </template>`,
      data,
      { Child },
    )

    const { html } = define(Parent).render()

    expect(html()).toBe(`<!--if--><!--slot-->`)

    data.value = { show: true, count: 1 }
    await nextTick()

    expect(html()).toBe(
      `<div child-s="">item</div><!--for--><!--if--><!--slot-->`,
    )

    data.value = { show: true, count: 2 }
    await nextTick()

    expect(html()).toBe(
      `<div child-s="">item</div><div child-s="">item</div><!--for--><!--if--><!--slot-->`,
    )
  })

  test(':slotted on teleported content added after mount', async () => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    const show = ref(false)

    try {
      const Child = defineVaporComponent({
        __scopeId: 'child',
        setup() {
          return createSlot('default')
        },
      })

      const { html } = define({
        setup() {
          return createComponent(
            Child,
            null,
            {
              default: () =>
                createComponent(
                  VaporTeleport,
                  { to: () => target },
                  {
                    default: () =>
                      createIf(
                        () => show.value,
                        () => template('<div>item</div>')(),
                      ),
                  },
                ),
            },
            true,
          )
        },
      }).render()

      expect(html()).toBe(`<!--teleport start--><!--teleport end--><!--slot-->`)
      expect(target.innerHTML).toBe(`<!--if-->`)

      show.value = true
      await nextTick()

      expect(target.innerHTML).toBe(`<div child-s="">item</div><!--if-->`)
    } finally {
      target.remove()
    }
  })

  test(':slotted on initial teleported content', () => {
    const target = document.createElement('div')
    document.body.appendChild(target)

    try {
      const Child = defineVaporComponent({
        __scopeId: 'child',
        setup() {
          return createSlot('default')
        },
      })

      const { html } = define({
        setup() {
          return createComponent(
            Child,
            null,
            {
              default: () =>
                createComponent(
                  VaporTeleport,
                  { to: () => target },
                  {
                    default: () => template('<div>item</div>')(),
                  },
                ),
            },
            true,
          )
        },
      }).render()

      expect(html()).toBe(`<!--teleport start--><!--teleport end--><!--slot-->`)
      expect(target.innerHTML).toBe(`<div child-s="">item</div>`)
    } finally {
      target.remove()
    }
  })

  test('nested components with slots', async () => {
    const Child = defineVaporComponent({
      setup() {
        const n0 = template('<div>')() as any
        setInsertionState(n0)
        createSlot('default')
        return n0
      },
    })
    const Parent = defineVaporComponent({
      __scopeId: 'data-v-parent',
      setup() {
        const n3 = createComponent(
          Child,
          null,
          {
            default: () => {
              const n2 = createComponent(
                Child,
                null,
                {
                  default: () => {
                    const n1 = createComponent(
                      Child,
                      null,
                      {
                        default: () => {
                          const t0 = template('test')() as any
                          return t0
                        },
                      },
                      true,
                    )
                    return n1
                  },
                },
                true,
              )
              return n2
            },
          },
          true,
        )
        return n3
      },
    })

    const { host } = define({
      __scopeId: 'app',
      setup() {
        return createComponent(Parent)
      },
    }).render()

    expect(host.innerHTML).toBe(
      `<div data-v-parent="" app="">` +
        `<div data-v-parent="">` +
        `<div data-v-parent="">test<!--slot-->` +
        `</div><!--slot-->` +
        `</div><!--slot-->` +
        `</div>`,
    )
  })

  test('nested components in vFor with slots', async () => {
    const Parent = defineVaporComponent({
      setup() {
        const n1 = template('<div>', 1)() as any
        setInsertionState(n1)
        createSlot('default', null)
        return n1
      },
    })

    const Child = defineVaporComponent({
      setup() {
        const n1 = template('<div>', 1)() as any
        setInsertionState(n1)
        createSlot('default', null)
        return n1
      },
    })

    const count = ref(0)
    const { html } = define({
      __scopeId: 'app',
      setup() {
        const n4 = createComponent(
          Parent,
          null,
          {
            default: () => {
              const n0 = createFor(
                () => count.value,
                _for_item0 => {
                  const n3 = createComponent(
                    Child,
                    { class: () => 'test' },
                    {
                      default: () => {
                        const n2 = template('<div> red ')()
                        return n2
                      },
                    },
                  )
                  return n3
                },
                item => item,
                2,
              )
              return n0
            },
          },
          true,
        )
        return n4
      },
    }).render()

    expect(html()).toBe(`<div app=""><!--for--><!--slot--></div>`)

    count.value++
    await nextTick()
    expect(html()).toBe(
      `<div app="">` +
        `<div class="test" app="">` + // should have app scopeId
        `<div> red </div><!--slot-->` +
        `</div><!--for-->` +
        `<!--slot--></div>`,
    )
  })

  test(':slotted on dynamic content inside v-for', async () => {
    const data = ref([true])
    const Child = compile(`<template><slot /></template>`, data)
    Child.__scopeId = 'child'

    const Parent = compile(
      `<template>
        <components.Child>
          <template v-for="show in data">
            <div v-if="show">on</div>
            <span v-else>off</span>
          </template>
        </components.Child>
      </template>`,
      data,
      { Child },
    )

    const { app, host } = define(Parent).render()
    expect(host.firstElementChild!.tagName).toBe('DIV')
    expect(host.firstElementChild!.hasAttribute('child-s')).toBe(true)

    data.value = [false]
    await nextTick()
    expect(host.firstElementChild!.tagName).toBe('SPAN')
    expect(host.firstElementChild!.hasAttribute('child-s')).toBe(true)
    app.unmount()
  })
})

describe('vdom interop', () => {
  test('vdom parent > vapor child', () => {
    const VaporChild = defineVaporComponent({
      __scopeId: 'vapor-child',
      setup() {
        return template('<button vapor-child></button>', 1)()
      },
    })

    const VdomParent = {
      __scopeId: 'vdom-parent',
      setup() {
        return () => h(VaporChild as any)
      },
    }

    const App = {
      setup() {
        return () => h(VdomParent)
      },
    }

    const root = document.createElement('div')
    createApp(App).use(vaporInteropPlugin).mount(root)

    expect(root.innerHTML).toBe(
      `<button vapor-child="" vdom-parent=""></button>`,
    )
  })

  test('vdom parent > vapor child with updated dynamic root', async () => {
    const useAltRoot = ref(false)
    const updatedSpy = vi.fn((vnode: any) => {
      expect((vnode.el as Element).hasAttribute('vdom-parent')).toBe(true)
    })

    const VaporChild = defineVaporComponent({
      __scopeId: 'vapor-child',
      props: {
        alt: Boolean,
      },
      setup(props: any) {
        return createIf(
          () => props.alt,
          () => template('<section>alt</section>', 1)(),
          () => template('<div>base</div>', 1)(),
        )
      },
    })

    const VdomParent = {
      __scopeId: 'vdom-parent',
      setup() {
        return () =>
          h(VaporChild as any, {
            alt: useAltRoot.value,
            onVnodeUpdated: updatedSpy,
          })
      },
    }

    const App = {
      setup() {
        return () => h(VdomParent)
      },
    }

    const root = document.createElement('div')
    createApp(App).use(vaporInteropPlugin).mount(root)

    expect(root.innerHTML).toBe(`<div vdom-parent="">base</div><!--if-->`)

    useAltRoot.value = true
    await nextTick()

    expect(root.innerHTML).toBe(
      `<section vdom-parent="">alt</section><!--if-->`,
    )
    expect(updatedSpy).toHaveBeenCalledTimes(1)
  })

  test('vdom parent > vapor child with internally updated dynamic root', async () => {
    const useAltRoot = ref(false)
    const calls: string[] = []
    let root!: HTMLDivElement

    const VaporChild = defineVaporComponent({
      __scopeId: 'vapor-child',
      setup() {
        onUpdated(() => {
          const el = root.firstChild as Element
          calls.push(`component:${el.hasAttribute('vdom-parent')}`)
        })
        return createIf(
          () => useAltRoot.value,
          () => template('<section>alt</section>', 1)(),
          () => template('<div>base</div>', 1)(),
        )
      },
    })

    const VdomParent = {
      __scopeId: 'vdom-parent',
      setup() {
        return () =>
          h(VaporChild as any, {
            onVnodeUpdated(vnode: any) {
              calls.push(
                `vnode:${(vnode.el as Element).hasAttribute('vdom-parent')}`,
              )
            },
          })
      },
    }

    const App = {
      setup() {
        return () => h(VdomParent)
      },
    }

    root = document.createElement('div')
    createApp(App).use(vaporInteropPlugin).mount(root)

    useAltRoot.value = true
    await nextTick()

    expect(root.innerHTML).toBe(
      `<section vdom-parent="">alt</section><!--if-->`,
    )
    expect(calls).toEqual(['component:true', 'vnode:true'])
  })

  test('vdom HOC parent > vapor child inherits scopeId on mount', () => {
    const VaporChild = defineVaporComponent({
      setup() {
        return template('<button></button>', 1)()
      },
    })

    function Child() {
      return h(Child2, { class: 'foo' })
    }

    function Child2() {
      return h(VaporChild as any)
    }
    Child2.inheritAttrs = false

    const App = {
      __scopeId: 'vdom-parent',
      setup() {
        return () => h(Child)
      },
    }

    const root = document.createElement('div')
    createApp(App).use(vaporInteropPlugin).mount(root)

    expect(root.innerHTML).toBe(`<button vdom-parent=""></button>`)
  })

  test('vdom slot owner > vapor slot content applies slot scopeId', () => {
    const VaporChild = defineVaporComponent({
      setup() {
        return template('<button></button>', 1)()
      },
    })

    const VdomSlotOwner = {
      __scopeId: 'vdom-slot-owner',
      setup(_props: unknown, { slots }: any) {
        return () => h('div', null, renderSlot(slots, 'default'))
      },
    }

    const VdomParent = {
      __scopeId: 'vdom-parent',
      setup() {
        return () =>
          h(VdomSlotOwner, null, {
            default: () => h(VaporChild as any),
          })
      },
    }

    const App = {
      setup() {
        return () => h(VdomParent)
      },
    }

    const root = document.createElement('div')
    createApp(App).use(vaporInteropPlugin).mount(root)

    expect(root.innerHTML).toBe(
      `<div vdom-slot-owner="" vdom-parent="">` +
        `<button vdom-parent="" vdom-slot-owner-s=""></button>` +
        `</div>`,
    )
  })

  test('vdom slot owner > vapor slot content preserves slot scopeIds on dynamic root update', async () => {
    const showAlt = ref(false)
    const VaporChild = defineVaporComponent({
      setup() {
        return createIf(
          () => showAlt.value,
          () => template('<span>alt</span>', 1)(),
          () => template('<button>base</button>', 1)(),
        )
      },
    })

    const VdomSlotOwner = {
      __scopeId: 'vdom-slot-owner',
      setup(_props: unknown, { slots }: any) {
        return () => h('div', null, renderSlot(slots, 'default'))
      },
    }

    const VdomParent = {
      __scopeId: 'vdom-parent',
      setup() {
        return () =>
          h(VdomSlotOwner, null, {
            default: () => h(VaporChild as any),
          })
      },
    }

    const App = {
      setup() {
        return () => h(VdomParent)
      },
    }

    const root = document.createElement('div')
    createApp(App).use(vaporInteropPlugin).mount(root)

    expect(root.innerHTML).toBe(
      `<div vdom-slot-owner="" vdom-parent="">` +
        `<button vdom-parent="" vdom-slot-owner-s="">base</button><!--if-->` +
        `</div>`,
    )

    showAlt.value = true
    await nextTick()

    expect(root.innerHTML).toBe(
      `<div vdom-slot-owner="" vdom-parent="">` +
        `<span vdom-parent="" vdom-slot-owner-s="">alt</span><!--if-->` +
        `</div>`,
    )
  })

  test('vdom slot owner > vapor v-if slot content added after mount', async () => {
    const show = ref(false)
    const VdomSlotOwner = {
      __scopeId: 'vdom-slot-owner',
      setup(_props: unknown, { slots }: any) {
        return () => h('div', null, renderSlot(slots, 'default'))
      },
    }

    const VaporParent = defineVaporComponent({
      setup() {
        return createComponent(
          VdomSlotOwner as any,
          null,
          {
            default: () =>
              createIf(
                () => show.value,
                () => template('<button>item</button>', 1)(),
              ),
          },
          true,
        )
      },
    })

    const App = {
      setup() {
        return () => h(VaporParent as any)
      },
    }

    const root = document.createElement('div')
    createApp(App).use(vaporInteropPlugin).mount(root)

    expect(root.innerHTML).toBe(`<div vdom-slot-owner=""><!--if--></div>`)

    show.value = true
    await nextTick()

    expect(root.innerHTML).toBe(
      `<div vdom-slot-owner="">` +
        `<button vdom-slot-owner-s="">item</button><!--if-->` +
        `</div>`,
    )
  })

  test('vdom slot owner > vapor v-if slot vdom child added after mount', async () => {
    const show = ref(false)
    const VdomChild = {
      __scopeId: 'vdom-child',
      setup() {
        return () => h('button', 'item')
      },
    }
    const VdomSlotOwner = {
      __scopeId: 'vdom-slot-owner',
      setup(_props: unknown, { slots }: any) {
        return () => h('div', null, renderSlot(slots, 'default'))
      },
    }

    const VaporParent = defineVaporComponent({
      setup() {
        return createComponent(
          VdomSlotOwner as any,
          null,
          {
            default: () =>
              createIf(
                () => show.value,
                () => createComponent(VdomChild as any),
              ),
          },
          true,
        )
      },
    })

    const App = {
      setup() {
        return () => h(VaporParent as any)
      },
    }

    const root = document.createElement('div')
    createApp(App).use(vaporInteropPlugin).mount(root)

    expect(root.innerHTML).toBe(`<div vdom-slot-owner=""><!--if--></div>`)

    show.value = true
    await nextTick()

    expect(root.innerHTML).toBe(
      `<div vdom-slot-owner="">` +
        `<button vdom-child="" vdom-slot-owner-s="">item</button><!--if-->` +
        `</div>`,
    )
  })

  test('vdom parent > vapor child with comment and single root', () => {
    const VaporChild = defineVaporComponent({
      setup() {
        return [document.createComment('v-if'), template('<button></button>')()]
      },
    })

    const VdomParent = {
      __scopeId: 'vdom-parent',
      setup() {
        return () => h(VaporChild as any)
      },
    }

    const App = {
      setup() {
        return () => h(VdomParent)
      },
    }

    const root = document.createElement('div')
    createApp(App).use(vaporInteropPlugin).mount(root)

    expect(root.innerHTML).toBe(`<!--v-if--><button vdom-parent=""></button>`)
  })

  test('vdom parent > vapor child applies scopeId to out-in transition delayed root', async () => {
    const show = ref(true)
    const onLeave = vi.fn((_el: Element, done: () => void) => {
      setTimeout(done, 0)
    })
    let interopVnode: any

    const VaporChild = defineVaporComponent({
      setup() {
        return createComponent(
          VaporTransition,
          {
            mode: () => 'out-in',
            onLeave: () => onLeave,
          },
          {
            default: () =>
              createIf(
                () => show.value,
                () => template('<div>A</div>', 1)(),
                () => template('<section>B</section>', 1)(),
              ),
          },
        )
      },
    })

    const VdomParent = {
      __scopeId: 'vdom-parent',
      setup() {
        return () =>
          h(VaporChild as any, {
            onVnodeMounted(vnode: any) {
              interopVnode = vnode
            },
          })
      },
    }

    const App = {
      setup() {
        return () => h(VdomParent)
      },
    }

    const root = document.createElement('div')
    createApp(App).use(vaporInteropPlugin).mount(root)

    expect(root.innerHTML).toBe(`<div vdom-parent="">A</div><!--if-->`)
    expect(interopVnode.el).toBe(root.firstChild)

    show.value = false
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 0))
    await nextTick()

    expect(onLeave).toHaveBeenCalledTimes(1)
    expect(root.innerHTML).toBe(
      `<section vdom-parent="" class="v-enter-from v-enter-active">B</section><!--if-->`,
    )
    expect(interopVnode.el).toBe(root.firstChild)
  })

  test('vdom parent > vapor child with updated multi-root dynamic fragment', async () => {
    const useMultiRoot = ref(false)

    const VaporChild = defineVaporComponent({
      setup() {
        return createIf(
          () => useMultiRoot.value,
          () => [
            template('<span>a</span>', 1)(),
            template('<span>b</span>', 1)(),
          ],
          () => template('<div>base</div>', 1)(),
        )
      },
    })

    const VdomParent = {
      __scopeId: 'vdom-parent',
      setup() {
        return () => h(VaporChild as any)
      },
    }

    const App = {
      setup() {
        return () => h(VdomParent)
      },
    }

    const root = document.createElement('div')
    createApp(App).use(vaporInteropPlugin).mount(root)

    expect(root.innerHTML).toBe(`<div vdom-parent="">base</div><!--if-->`)

    useMultiRoot.value = true
    await nextTick()

    expect(root.innerHTML).toBe(`<span>a</span><span>b</span><!--if-->`)
  })

  test('vdom parent > async vapor child applies scopeId after resolve', async () => {
    let resolve!: (component: any) => void
    const VaporAsyncChild = defineVaporAsyncComponent({
      loader: () =>
        new Promise<any>(_resolve => {
          resolve = _resolve
        }),
    })

    const VdomParent = {
      __scopeId: 'vdom-parent',
      setup() {
        return () => h(VaporAsyncChild as any)
      },
    }

    const App = {
      setup() {
        return () => h(VdomParent)
      },
    }

    const root = document.createElement('div')
    createApp(App).use(vaporInteropPlugin).mount(root)

    expect(root.innerHTML).toBe(`<!--async component-->`)

    resolve(
      defineVaporComponent({
        setup() {
          return template('<button>resolved</button>', 1)()
        },
      }),
    )
    await new Promise(resolve => setTimeout(resolve))
    await nextTick()

    expect(root.innerHTML).toBe(
      `<button vdom-parent="">resolved</button><!--async component-->`,
    )
  })

  test('vdom parent > vapor child > vdom child', () => {
    const VdomChild = {
      __scopeId: 'vdom-child',
      setup() {
        return () => h('button')
      },
    }

    const VaporChild = defineVaporComponent({
      __scopeId: 'vapor-child',
      setup() {
        return createComponent(VdomChild as any, null, null, true)
      },
    })

    const VdomParent = {
      __scopeId: 'vdom-parent',
      setup() {
        return () => h(VaporChild as any)
      },
    }

    const App = {
      setup() {
        return () => h(VdomParent)
      },
    }

    const root = document.createElement('div')
    createApp(App).use(vaporInteropPlugin).mount(root)

    expect(root.innerHTML).toBe(
      `<button vdom-child="" vapor-child="" vdom-parent=""></button>`,
    )
  })

  test('vdom parent > vapor child > vapor child > vdom child', () => {
    const VdomChild = {
      __scopeId: 'vdom-child',
      setup() {
        return () => h('button')
      },
    }

    const NestedVaporChild = defineVaporComponent({
      __scopeId: 'nested-vapor-child',
      setup() {
        return createComponent(VdomChild as any, null, null, true)
      },
    })

    const VaporChild = defineVaporComponent({
      __scopeId: 'vapor-child',
      setup() {
        return createComponent(NestedVaporChild as any, null, null, true)
      },
    })

    const VdomParent = {
      __scopeId: 'vdom-parent',
      setup() {
        return () => h(VaporChild as any)
      },
    }

    const App = {
      setup() {
        return () => h(VdomParent)
      },
    }

    const root = document.createElement('div')
    createApp(App).use(vaporInteropPlugin).mount(root)

    expect(root.innerHTML).toBe(
      `<button vdom-child="" nested-vapor-child="" vapor-child="" vdom-parent=""></button>`,
    )
  })

  test('vdom parent > vapor dynamic child', () => {
    const VaporChild = defineVaporComponent({
      __scopeId: 'vapor-child',
      setup() {
        return createDynamicComponent(
          () => 'button',
          null,
          null,
          VaporDynamicComponentFlags.SINGLE_ROOT,
        )
      },
    })

    const VdomParent = {
      __scopeId: 'vdom-parent',
      setup() {
        return () => h(VaporChild as any)
      },
    }

    const App = {
      setup() {
        return () => h(VdomParent)
      },
    }

    const root = document.createElement('div')
    createApp(App).use(vaporInteropPlugin).mount(root)

    expect(root.innerHTML).toBe(
      `<button vapor-child="" vdom-parent=""></button><!--dynamic-component-->`,
    )
  })

  test('vapor parent > vdom child', () => {
    const VdomChild = {
      __scopeId: 'vdom-child',
      setup() {
        return () => h('button')
      },
    }

    const VaporParent = defineVaporComponent({
      __scopeId: 'vapor-parent',
      setup() {
        return createComponent(VdomChild as any, null, null, true)
      },
    })

    const App = {
      setup() {
        return () => h(VaporParent as any)
      },
    }

    const root = document.createElement('div')
    createApp(App).use(vaporInteropPlugin).mount(root)

    expect(root.innerHTML).toBe(
      `<button vdom-child="" vapor-parent=""></button>`,
    )
  })

  test('vapor parent > vdom child > vapor child', () => {
    const VaporChild = defineVaporComponent({
      __scopeId: 'vapor-child',
      setup() {
        return template('<button vapor-child></button>', 1)()
      },
    })

    const VdomChild = {
      __scopeId: 'vdom-child',
      setup() {
        return () => h(VaporChild as any)
      },
    }

    const VaporParent = defineVaporComponent({
      __scopeId: 'vapor-parent',
      setup() {
        return createComponent(VdomChild as any, null, null, true)
      },
    })

    const App = {
      setup() {
        return () => h(VaporParent as any)
      },
    }

    const root = document.createElement('div')
    createApp(App).use(vaporInteropPlugin).mount(root)

    expect(root.innerHTML).toBe(
      `<button vapor-child="" vdom-child="" vapor-parent=""></button>`,
    )
  })

  test('vapor parent > vdom child > vdom child > vapor child', () => {
    const VaporChild = defineVaporComponent({
      __scopeId: 'vapor-child',
      setup() {
        return template('<button vapor-child></button>', 1)()
      },
    })

    const VdomChild = {
      __scopeId: 'vdom-child',
      setup() {
        return () => h(VaporChild as any)
      },
    }

    const VdomParent = {
      __scopeId: 'vdom-parent',
      setup() {
        return () => h(VdomChild as any)
      },
    }

    const VaporParent = defineVaporComponent({
      __scopeId: 'vapor-parent',
      setup() {
        return createComponent(VdomParent as any, null, null, true)
      },
    })

    const App = {
      setup() {
        return () => h(VaporParent as any)
      },
    }

    const root = document.createElement('div')
    createApp(App).use(vaporInteropPlugin).mount(root)

    expect(root.innerHTML).toBe(
      `<button vapor-child="" vdom-child="" vdom-parent="" vapor-parent=""></button>`,
    )
  })

  test('vapor parent > vapor slot > vdom child', () => {
    const VaporSlot = defineVaporComponent({
      __scopeId: 'vapor-slot',
      setup() {
        const n1 = template('<div vapor-slot></div>', 1)() as any
        setInsertionState(n1)
        createSlot('default', null)
        return n1
      },
    })

    const VdomChild = {
      __scopeId: 'vdom-child',
      setup() {
        return () => h('span')
      },
    }

    const VaporParent = defineVaporComponent({
      __scopeId: 'vapor-parent',
      setup() {
        const n2 = createComponent(
          VaporSlot,
          null,
          {
            default: () => {
              const n0 = template('<div vapor-parent></div>')()
              const n1 = createComponent(VdomChild)
              return [n0, n1]
            },
          },
          true,
        )
        return n2
      },
    })

    const App = {
      setup() {
        return () => h(VaporParent as any)
      },
    }

    const root = document.createElement('div')
    createApp(App).use(vaporInteropPlugin).mount(root)

    expect(root.innerHTML).toBe(
      `<div vapor-slot="" vapor-parent="">` +
        `<div vapor-parent="" vapor-slot-s=""></div>` +
        `<span vdom-child="" vapor-parent="" vapor-slot-s=""></span>` +
        `<!--slot-->` +
        `</div>`,
    )
  })

  test('vapor parent > vapor slot > vdom dynamic child', async () => {
    const showAlt = ref(false)
    const VaporSlot = defineVaporComponent({
      __scopeId: 'vapor-slot',
      setup() {
        const n1 = template('<div vapor-slot></div>', 1)() as any
        setInsertionState(n1)
        createSlot('default', null)
        return n1
      },
    })

    const VdomChild = {
      __scopeId: 'vdom-child',
      setup() {
        return () => (showAlt.value ? h('span', 'alt') : h('button', 'base'))
      },
    }

    const VaporParent = defineVaporComponent({
      __scopeId: 'vapor-parent',
      setup() {
        return createComponent(
          VaporSlot,
          null,
          {
            default: () => createComponent(VdomChild),
          },
          true,
        )
      },
    })

    const App = {
      setup() {
        return () => h(VaporParent as any)
      },
    }

    const root = document.createElement('div')
    createApp(App).use(vaporInteropPlugin).mount(root)

    expect(root.innerHTML).toBe(
      `<div vapor-slot="" vapor-parent="">` +
        `<button vdom-child="" vapor-parent="" vapor-slot-s="">base</button>` +
        `<!--slot-->` +
        `</div>`,
    )

    showAlt.value = true
    await nextTick()

    expect(root.innerHTML).toBe(
      `<div vapor-slot="" vapor-parent="">` +
        `<span vdom-child="" vapor-parent="" vapor-slot-s="">alt</span>` +
        `<!--slot-->` +
        `</div>`,
    )
  })

  test('does not apply root-only component scopeId to VDOM slot content or a late VDOM fallback', async () => {
    const mountCase = (VaporChild: any, slotFn: () => any) => {
      const App = {
        setup() {
          return () => {
            const child = h(VaporChild, null, { default: slotFn })
            child.scopeId = 'external'
            return child
          }
        },
      }
      const root = document.createElement('div')
      const app = createApp(App).use(vaporInteropPlugin)
      app.mount(root)
      return { root, app }
    }

    // swapped slot content
    const showAlt = ref(false)
    let { root, app } = mountCase(
      defineVaporComponent({
        setup() {
          return createSlot('default') as any
        },
      }),
      () => (showAlt.value ? h('section', 'alt') : h('div', 'base')),
    )
    expect(root.innerHTML).toBe(`<div>base</div>`)
    showAlt.value = true
    await nextTick()
    expect(root.innerHTML).toBe(`<section>alt</section>`)
    app.unmount()

    // VDOM fallback created later, through a forwarded outlet
    const show = ref(true)
    const VDomOutlet = {
      setup(_: unknown, { slots }: any) {
        return () =>
          renderSlot(slots, 'default', {}, () => [h('span', 'fallback')])
      },
    }
    ;({ root, app } = mountCase(
      defineVaporComponent({
        setup() {
          return createComponent(
            VDomOutlet as any,
            null,
            {
              default: () =>
                createSlot(
                  'default',
                  null,
                  undefined,
                  VaporSlotFlags.SLOT_ROOT | VaporSlotFlags.INHERIT_FALLBACK,
                ),
            },
            true,
          )
        },
      }),
      () => (show.value ? h('div', 'content') : []),
    ))
    expect(root.innerHTML).toBe(`<div>content</div>`)
    show.value = false
    await nextTick()
    expect(root.innerHTML).toBe(`<span>fallback</span>`)
    app.unmount()
  })

  test('matches VDOM root-only scopeId behavior for slot content and fallback', async () => {
    const show = ref(true)
    const VDOMChild = {
      setup(_: unknown, { slots }: any) {
        return () =>
          renderSlot(slots, 'default', {}, () => [h('span', 'fallback')])
      },
    }
    const VaporChild = defineVaporComponent({
      setup() {
        return createSlot(
          'default',
          null,
          () => template('<span>fallback</span>')(),
          VaporSlotFlags.SLOT_ROOT,
        ) as any
      },
    })
    const createParent = (Child: any) => ({
      setup() {
        return () => {
          const child = h(Child, null, {
            default: () => (show.value ? h('div', 'content') : []),
          })
          child.scopeId = 'external'
          return child
        }
      },
    })

    const vdomRoot = document.createElement('div')
    const vdomApp = createApp(createParent(VDOMChild))
    vdomApp.mount(vdomRoot)
    const vaporRoot = document.createElement('div')
    const vaporApp = createApp(createParent(VaporChild)).use(vaporInteropPlugin)
    vaporApp.mount(vaporRoot)

    expect(vdomRoot.innerHTML).toBe(`<div>content</div>`)
    expect(vaporRoot.innerHTML).toBe(vdomRoot.innerHTML)

    show.value = false
    await nextTick()
    expect(vdomRoot.innerHTML).toBe(`<span>fallback</span>`)
    expect(vaporRoot.innerHTML).toBe(vdomRoot.innerHTML)

    vdomApp.unmount()
    vaporApp.unmount()
  })

  test.each([
    ['a single child', 1],
    ['multiple children', 2],
  ] as const)(
    'matches VDOM component scopeId behavior for a Fragment with %s',
    (_, childCount) => {
      const renderFragment = () =>
        h(Fragment, null, childCount === 1 ? [h('div')] : [h('div'), h('span')])
      const VDOMChild = {
        setup: () => renderFragment,
      }
      const VaporChild = defineVaporComponent({
        setup() {
          return createDynamicComponent(
            renderFragment,
            null,
            null,
            VaporDynamicComponentFlags.SINGLE_ROOT,
          )
        },
      })
      const createParent = (Child: any) => ({
        __scopeId: 'external',
        setup() {
          return () => h(Child)
        },
      })

      const vdomRoot = document.createElement('div')
      const vdomApp = createApp(createParent(VDOMChild))
      vdomApp.mount(vdomRoot)
      expect(vdomRoot.children).toHaveLength(childCount)
      for (const child of vdomRoot.children) {
        expect(child.hasAttribute('external')).toBe(false)
      }

      const vaporRoot = document.createElement('div')
      const vaporApp = createApp(createParent(VaporChild)).use(
        vaporInteropPlugin,
      )
      vaporApp.mount(vaporRoot)
      expect(vaporRoot.children).toHaveLength(childCount)
      for (const child of vaporRoot.children) {
        expect(child.hasAttribute('external')).toBe(false)
      }

      vdomApp.unmount()
      vaporApp.unmount()
    },
  )

  test('VDOM Teleport children receive slotted ids but not root-only scopeId', () => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    const mountApp = (App: any) => {
      const root = document.createElement('div')
      const app = createApp(App).use(vaporInteropPlugin)
      app.mount(root)
      return app
    }

    // root-only component scopeId does not reach teleported children
    const VaporChild = defineVaporComponent({
      setup() {
        const vnode = h(Teleport, { to: target }, h('div'))
        return createDynamicComponent(
          () => vnode,
          null,
          null,
          VaporDynamicComponentFlags.SINGLE_ROOT,
        )
      },
    })
    let app = mountApp({
      __scopeId: 'external',
      setup() {
        return () => h(VaporChild as any)
      },
    })
    expect(target.firstElementChild!.hasAttribute('external')).toBe(false)
    app.unmount()

    // slotted ids do
    const Receiver = defineVaporComponent({
      __scopeId: 'receiver',
      setup() {
        return createSlot('default', null, undefined, VaporSlotFlags.SLOT_ROOT)
      },
    })
    app = mountApp({
      setup() {
        return () =>
          h(Receiver as any, null, {
            default: () => h(Teleport, { to: target }, h('div')),
          })
      },
    })
    expect(target.firstElementChild!.hasAttribute('receiver-s')).toBe(true)
    expect(target.firstElementChild!.hasAttribute('receiver')).toBe(false)
    app.unmount()
    target.remove()
  })

  test('does not retain fragment context when cloning a component VNode', () => {
    const VDOMChild = {
      setup() {
        return () => h('div')
      },
    }
    const source = h(VDOMChild)
    const Receiver = defineVaporComponent({
      __scopeId: 'receiver',
      setup() {
        return createSlot('default', null, undefined, VaporSlotFlags.SLOT_ROOT)
      },
    })
    const ScopedApp = {
      setup() {
        return () =>
          h(Receiver as any, null, {
            default: () => h(Fragment, null, [source]),
          })
      },
    }
    const firstRoot = document.createElement('div')
    const firstApp = createApp(ScopedApp).use(vaporInteropPlugin)
    firstApp.mount(firstRoot)
    expect(firstRoot.firstElementChild!.hasAttribute('receiver-s')).toBe(true)

    const cloned = cloneVNode(source)
    firstApp.unmount()
    const PlainChild = defineVaporComponent({
      setup() {
        return createDynamicComponent(
          () => cloned,
          null,
          null,
          VaporDynamicComponentFlags.SINGLE_ROOT,
        )
      },
    })
    const PlainApp = {
      setup() {
        return () => h(PlainChild as any)
      },
    }
    const secondRoot = document.createElement('div')
    const secondApp = createApp(PlainApp).use(vaporInteropPlugin)
    secondApp.mount(secondRoot)

    expect(secondRoot.querySelector('div')!.hasAttribute('receiver-s')).toBe(
      false,
    )
    secondApp.unmount()
  })

  test('applies slotted scopeId to forwarded vapor slot content', () => {
    const Receiver = defineVaporComponent({
      __scopeId: 'receiver',
      setup() {
        return createSlot('default', null, undefined, VaporSlotFlags.SLOT_ROOT)
      },
    })

    // VDOM middle component forwarding the vapor-origin slots object, so the
    // slot content reaching Receiver is a bare VaporSlot VNode.
    const Middle = {
      setup(_props: unknown, { slots }: any) {
        return () => h(Receiver as any, null, slots)
      },
    }

    const VaporSender = defineVaporComponent({
      setup() {
        return createComponent(Middle as any, null, {
          default: () => template('<div class="content">content</div>', 1)(),
        })
      },
    })

    const App = {
      setup() {
        return () => h(VaporSender as any)
      },
    }

    const root = document.createElement('div')
    const app = createApp(App).use(vaporInteropPlugin)
    app.mount(root)

    const content = root.querySelector('.content')!
    expect(content.hasAttribute('receiver-s')).toBe(true)
    expect(content.hasAttribute('receiver')).toBe(false)
    app.unmount()
  })

  test('matches VDOM root-only scopeId behavior for a root slot', async () => {
    const data = ref({ show: true })
    const makeApp = (vapor: boolean) => {
      const source = (template: string) =>
        vapor
          ? template
          : `<script setup>
              const data = _data
              const components = _components
            </script>${template}`
      const Receiver = compile(
        source(`<template><slot><span>fallback</span></slot></template>`),
        data,
        {},
        { vapor },
      )
      const Middle = compile(
        source(`<template>
          <components.Receiver>
            <div v-if="data.show">content</div>
          </components.Receiver>
        </template>`),
        data,
        { Receiver },
        { vapor },
      )
      const App = compile(
        source(`<template><components.Middle /></template>`),
        data,
        { Middle },
        { vapor },
      )
      App.__scopeId = 'grand'
      return App
    }

    const vdomRoot = document.createElement('div')
    const vdomApp = createApp(makeApp(false))
    vdomApp.mount(vdomRoot)
    const vaporRoot = document.createElement('div')
    const vaporApp = createVaporApp(makeApp(true))
    vaporApp.mount(vaporRoot)

    expect(vdomRoot.firstElementChild!.tagName).toBe('DIV')
    expect(vaporRoot.firstElementChild!.tagName).toBe('DIV')
    expect(vdomRoot.firstElementChild!.hasAttribute('grand')).toBe(false)
    expect(vaporRoot.firstElementChild!.hasAttribute('grand')).toBe(false)

    data.value = { show: false }
    await nextTick()
    expect(vdomRoot.firstElementChild!.tagName).toBe('SPAN')
    expect(vaporRoot.firstElementChild!.tagName).toBe('SPAN')
    expect(vdomRoot.firstElementChild!.hasAttribute('grand')).toBe(false)
    expect(vaporRoot.firstElementChild!.hasAttribute('grand')).toBe(false)

    vdomApp.unmount()
    vaporApp.unmount()

    // positive control: with an element root above the outlet, the same
    // chain does deliver the id, so the negatives cannot pass vacuously
    const makeControlApp = (vapor: boolean) => {
      const source = (template: string) =>
        vapor
          ? template
          : `<script setup>
              const data = _data
              const components = _components
            </script>${template}`
      const Receiver = compile(
        source(`<template><slot><span>fallback</span></slot></template>`),
        data,
        {},
        { vapor },
      )
      const Middle = compile(
        source(`<template>
          <div class="wrapper"><components.Receiver>
            <div v-if="data.show">content</div>
          </components.Receiver></div>
        </template>`),
        data,
        { Receiver },
        { vapor },
      )
      const App = compile(
        source(`<template><components.Middle /></template>`),
        data,
        { Middle },
        { vapor },
      )
      App.__scopeId = 'grand'
      return App
    }
    const vdomControlRoot = document.createElement('div')
    const vdomControlApp = createApp(makeControlApp(false))
    vdomControlApp.mount(vdomControlRoot)
    const vaporControlRoot = document.createElement('div')
    const vaporControlApp = createVaporApp(makeControlApp(true))
    vaporControlApp.mount(vaporControlRoot)
    expect(
      vdomControlRoot.querySelector('.wrapper')!.hasAttribute('grand'),
    ).toBe(true)
    expect(
      vaporControlRoot.querySelector('.wrapper')!.hasAttribute('grand'),
    ).toBe(true)
    vdomControlApp.unmount()
    vaporControlApp.unmount()
  })

  test('applies slotted scope id to interop content under an adopted slot anchor', () => {
    const data = ref(0)
    const Child = compile(
      `<template><div><span/><slot/><b/></div></template>`,
      data,
    )
    ;(Child as any).__scopeId = 'child'
    const Parent = defineVaporComponent({
      setup() {
        return createComponent(Child as any, null, {
          default: () => createDynamicComponent(() => h('p', 'x')),
        })
      },
    })
    const root = document.createElement('div')
    const app = createApp({ render: () => h(Parent as any) }).use(
      vaporInteropPlugin,
    )
    app.mount(root)
    // the outlet adopts an in-DOM anchor, so the interop child mounts during
    // the slot render — before the outlet's post-render id application
    expect(root.querySelector('p')!.hasAttribute('child-s')).toBe(true)
    app.unmount()
  })

  test(':slotted reaches slot content revealed after starting behind fallback', async () => {
    const data = ref(false)
    const Child = compile(`<template><slot><i>fb</i></slot></template>`, data)
    ;(Child as any).__scopeId = 'child'
    const Parent = compile(
      `<template><components.Child><em v-if="data">c</em></components.Child></template>`,
      data,
      { Child },
    )

    const { app, host } = define(Parent).render()
    expect(host.querySelector('i')!.hasAttribute('child-s')).toBe(true)

    data.value = true
    await nextTick()
    // content parked behind the active fallback still received the slot's
    // ids, so re-exposing it yields the same DOM as VDOM (<em child-s>)
    expect(host.querySelector('em')!.hasAttribute('child-s')).toBe(true)
    app.unmount()
  })

  describe('slotted scope id depth parity with VDOM', () => {
    const vdomCompile = (template: string, data: any, components: any = {}) =>
      compile(
        `<script setup>const data = _data; const components = _components;</script>` +
          template,
        data,
        components,
        { vapor: false },
      )

    // strip anchors, and the lexical scope attr the VDOM side applies at
    // runtime from post-compile __scopeId (vapor bakes lexical ids at compile
    // time, which the test compile helper does not do) — only slotted (-s)
    // parity is under test
    const strip = (html: string) =>
      html.replace(/<!--[^>]*-->/g, '').replace(/ receiver=""/g, '')

    const mountPair = (makeSide: (vapor: boolean) => any) => {
      const vdomHost = document.createElement('div')
      const vdomApp = createApp(makeSide(false))
      vdomApp.mount(vdomHost)
      const host = document.createElement('div')
      const app = createVaporApp(makeSide(true))
      app.mount(host)
      return {
        vdomHost,
        host,
        unmount: () => {
          vdomApp.unmount()
          app.unmount()
        },
      }
    }

    const makeSides =
      (
        parentTemplate: string,
        {
          receiver = `<template><slot/></template>`,
          data = ref<any>(0),
          components = {} as Record<string, string>,
        } = {},
      ) =>
      (vapor: boolean) => {
        const c = vapor ? compile : vdomCompile
        const compiled: Record<string, any> = {}
        for (const name in components) {
          compiled[name] = c(components[name], data)
        }
        const Receiver = c(receiver, data)
        Receiver.__scopeId = 'receiver'
        return c(parentTemplate, data, { Receiver, ...compiled })
      }

    test('slotted id reaches nested elements but not component internals', () => {
      let { vdomHost, host, unmount } = mountPair(
        makeSides(
          `<template><components.Receiver><div><span>x</span></div></components.Receiver></template>`,
        ),
      )
      expect(strip(host.innerHTML)).toBe(strip(vdomHost.innerHTML))
      expect(strip(host.innerHTML)).toContain('<span receiver-s="">x</span>')
      unmount()
      ;({ vdomHost, host, unmount } = mountPair(
        makeSides(
          `<template><components.Receiver><div><components.Comp/></div></components.Receiver></template>`,
          { components: { Comp: `<template><b><u>x</u></b></template>` } },
        ),
      ))
      expect(strip(host.innerHTML)).toBe(strip(vdomHost.innerHTML))
      unmount()
    })

    test('v-if / v-for content added after mount carries ids at depth', async () => {
      const show = ref(false)
      let { vdomHost, host, unmount } = mountPair(
        makeSides(
          `<template><components.Receiver><div v-if="data"><span>x</span></div></components.Receiver></template>`,
          { data: show },
        ),
      )
      show.value = true
      await nextTick()
      expect(strip(host.innerHTML)).toBe(strip(vdomHost.innerHTML))
      expect(strip(host.innerHTML)).toContain('receiver-s')
      unmount()

      const count = ref(0)
      ;({ vdomHost, host, unmount } = mountPair(
        makeSides(
          `<template><components.Receiver><div v-for="i in data"><span>{{ i }}</span></div></components.Receiver></template>`,
          { data: count },
        ),
      ))
      count.value = 2
      await nextTick()
      expect(strip(host.innerHTML)).toBe(strip(vdomHost.innerHTML))
      expect(strip(host.innerHTML)).toContain('receiver-s')
      unmount()
    })

    test('fallback content carries ids at depth', () => {
      const { vdomHost, host, unmount } = mountPair(
        makeSides(`<template><components.Receiver/></template>`, {
          receiver: `<template><slot><div><span>fb</span></div></slot></template>`,
        }),
      )
      expect(strip(host.innerHTML)).toBe(strip(vdomHost.innerHTML))
      expect(strip(host.innerHTML)).toContain('receiver-s')
      unmount()
    })
  })

  test('applies inherited root-only scope id to the interop element root only', () => {
    const VaporChild = defineVaporComponent({
      setup() {
        return createDynamicComponent(
          () => h('div', [h('span', 'x')]),
          null,
          null,
          VaporDynamicComponentFlags.SINGLE_ROOT,
        )
      },
    })
    const root = document.createElement('div')
    const app = createApp({
      __scopeId: 'external',
      render: () => h(VaporChild as any),
    }).use(vaporInteropPlugin)
    app.mount(root)
    // VDOM control renders <div external><span>x</span></div>: the id stops
    // at the effective root instead of broadcasting to descendants
    expect(root.querySelector('div')!.hasAttribute('external')).toBe(true)
    expect(root.querySelector('span')!.hasAttribute('external')).toBe(false)
    app.unmount()
  })

  test('applies inherited root-only scope id to an async-resolved interop Suspense root', async () => {
    const makeSide = () => {
      let resolveSetup: (() => void) | undefined
      const AsyncInner = {
        async setup() {
          await new Promise<void>(r => (resolveSetup = r))
          return () => h('section', 'done')
        },
      }
      const suspenseVNode = () =>
        h(Suspense, null, {
          default: () => h(AsyncInner),
          fallback: () => h('div', 'loading'),
        })
      return { suspenseVNode, resolve: () => resolveSetup!() }
    }

    const vdomSide = makeSide()
    const vdomRoot = document.createElement('div')
    const vdomApp = createApp({
      __scopeId: 'external',
      render: () => h({ render: vdomSide.suspenseVNode }),
    })
    vdomApp.mount(vdomRoot)

    const vaporSide = makeSide()
    const VaporChild = defineVaporComponent({
      setup() {
        return createDynamicComponent(
          vaporSide.suspenseVNode,
          null,
          null,
          VaporDynamicComponentFlags.SINGLE_ROOT,
        )
      },
    })
    const vaporRoot = document.createElement('div')
    const vaporApp = createApp({
      __scopeId: 'external',
      render: () => h(VaporChild as any),
    }).use(vaporInteropPlugin)
    vaporApp.mount(vaporRoot)

    // the fallback is the current effective root and inherits the id
    expect(vdomRoot.querySelector('div')!.hasAttribute('external')).toBe(true)
    expect(vaporRoot.querySelector('div')!.hasAttribute('external')).toBe(true)

    vdomSide.resolve()
    vaporSide.resolve()
    await new Promise(r => setTimeout(r))
    await nextTick()

    // the resolved branch becomes the effective root and inherits the id
    expect(vdomRoot.querySelector('section')).toBeTruthy()
    expect(vdomRoot.querySelector('section')!.hasAttribute('external')).toBe(
      true,
    )
    expect(vaporRoot.querySelector('section')).toBeTruthy()
    expect(vaporRoot.querySelector('section')!.hasAttribute('external')).toBe(
      true,
    )

    vdomApp.unmount()
    vaporApp.unmount()
  })

  // Full lifecycle matrix for slot scope context transitions under a stable
  // slot function: every supported component-root representation, both
  // future-root kinds, both context directions, always compared against the
  // pure VDOM result. Invariant per cell: existing DOM keeps its mount-time
  // ids, anything mounted afterwards receives the latest ids.

  test('matches VDOM slotted scopeId for late content inside a static element', async () => {
    // 0 → 1 flips the v-if branch, mounts one v-for item, and swaps the
    // Inner component's future root
    const runCase = async (
      vapor: boolean,
      parentContent: string,
      innerTemplate?: string,
    ) => {
      const data = ref<any>(0)
      const source = (template: string) =>
        vapor
          ? template
          : `<script setup>const data = _data; const components = _components;</script>${template}`
      const Receiver = compile(
        source(`<template><slot /></template>`),
        data,
        {},
        { vapor },
      )
      Receiver.__scopeId = 'receiver'
      const components: any = { Receiver }
      if (innerTemplate) {
        components.Inner = compile(source(innerTemplate), data, {}, { vapor })
      }
      const Parent = compile(
        source(
          `<template><components.Receiver><div>${parentContent}</div></components.Receiver></template>`,
        ),
        data,
        components,
        { vapor },
      )
      const root = document.createElement('div')
      const app = vapor ? createVaporApp(Parent) : createApp(Parent)
      app.mount(root)

      data.value = 1
      await nextTick()
      return { root, app }
    }

    for (const vapor of [false, true]) {
      // late v-if branch
      let { root, app } = await runCase(vapor, `<span v-if="data">late</span>`)
      expect(root.querySelector('span')!.hasAttribute('receiver-s')).toBe(true)
      app.unmount()

      // component whose future root appears late: ids reach the new root
      // but not its internals
      ;({ root, app } = await runCase(
        vapor,
        `<components.Inner />`,
        `<template><span v-if="data"><u>late</u></span><i v-else>initial</i></template>`,
      ))
      expect(root.querySelector('span')!.hasAttribute('receiver-s')).toBe(true)
      expect(root.querySelector('u')!.hasAttribute('receiver-s')).toBe(false)
      app.unmount()

      // late v-for item
      ;({ root, app } = await runCase(
        vapor,
        `<span v-for="i in data">late</span>`,
      ))
      expect(root.querySelector('span')!.hasAttribute('receiver-s')).toBe(true)
      app.unmount()
    }
  })

  test('does not publish root-only scope id onto vapor-teleported interop content', async () => {
    const showAlt = ref(false)
    const scopeId = ref('external')
    const target = document.createElement('div')
    document.body.appendChild(target)
    const VdomInner = {
      setup() {
        return () => (showAlt.value ? h('section', 'alt') : h('div', 'base'))
      },
    }
    const VaporChild = defineVaporComponent({
      setup() {
        return createComponent(
          VaporTeleport,
          { to: () => target },
          { default: () => createComponent(VdomInner as any) },
        )
      },
    })
    const App = {
      setup() {
        return () => {
          const child = h(VaporChild as any)
          child.scopeId = scopeId.value
          return child
        }
      },
    }
    const root = document.createElement('div')
    const app = createApp(App).use(vaporInteropPlugin)
    app.mount(root)
    expect(target.querySelector('div')!.hasAttribute('external')).toBe(false)

    // An update-path republish runs after the teleport children exist — the
    // walk must still stop at the teleport boundary instead of publishing
    // onto the teleported interop content.
    scopeId.value = 'external2'
    await nextTick()

    // teleported content is never the vapor component's effective root, so a
    // root materialized after the republish must not read a wrongly
    // published carrier (VDOM Teleport parity).
    showAlt.value = true
    await nextTick()
    expect(target.querySelector('section')).toBeTruthy()
    expect(target.querySelector('section')!.hasAttribute('external')).toBe(
      false,
    )
    expect(target.querySelector('section')!.hasAttribute('external2')).toBe(
      false,
    )

    app.unmount()
    target.remove()
  })

  test('publishes ancestor scope ids across a fragment link in the root chain', async () => {
    const showAlt = ref(false)
    const VdomInner = {
      setup() {
        return () => (showAlt.value ? h('section', 'alt') : h('div', 'base'))
      },
    }
    const Middle = defineVaporComponent({
      setup() {
        return createComponent(VdomInner as any, null, null, true)
      },
    })
    const Outer = defineVaporComponent({
      setup() {
        // the chain passes through a fragment: Outer.block is the v-if
        // fragment, not the Middle instance
        return createIf(
          () => true,
          () => createComponent(Middle, null, null, true),
        )
      },
    })
    const App = {
      setup() {
        return () => {
          const child = h(Outer as any)
          child.scopeId = 'outer-a'
          return child
        }
      },
    }
    const root = document.createElement('div')
    const app = createApp(App).use(vaporInteropPlugin)
    app.mount(root)
    expect(root.querySelector('div')!.hasAttribute('outer-a')).toBe(true)

    // a root materialized later reads the published carrier, whose canonical
    // derivation must climb across the fragment link
    showAlt.value = true
    await nextTick()
    expect(root.querySelector('section')!.hasAttribute('outer-a')).toBe(true)
    app.unmount()
  })
})
