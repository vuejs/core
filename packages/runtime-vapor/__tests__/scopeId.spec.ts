import {
  Fragment,
  KeepAlive,
  Suspense,
  Teleport,
  cloneVNode,
  createApp,
  defineComponent,
  h,
  nextTick,
  onUpdated,
  ref,
  renderSlot,
} from '@vue/runtime-dom'
import { VaporDynamicComponentFlags, VaporSlotFlags } from '@vue/shared'
import { BindingTypes } from '@vue/compiler-dom'
import {
  VaporKeepAlive,
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
  renderEffect,
  setElementText,
  setInsertionState,
  template,
  vaporInteropPlugin,
} from '../src'
import { compile, compileToVaporRender, makeRender } from './_utils'

const define = makeRender()
const slottedScopeProbeConnections = ((
  globalThis as any
).__slottedScopeProbeConnections ||= []) as boolean[]

function defineSlottedScopeProbe() {
  if (!customElements.get('slotted-scope-probe')) {
    customElements.define(
      'slotted-scope-probe',
      class extends HTMLElement {
        connectedCallback() {
          slottedScopeProbeConnections.push(this.hasAttribute('child-s'))
        }
      },
    )
  }
}

const externalScopeProbeConnections = ((
  globalThis as any
).__externalScopeProbeConnections ||= []) as boolean[]

function defineExternalScopeProbe() {
  if (!customElements.get('external-scope-probe')) {
    customElements.define(
      'external-scope-probe',
      class extends HTMLElement {
        connectedCallback() {
          externalScopeProbeConnections.push(this.hasAttribute('external'))
        }
      },
    )
  }
}

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

  test(':slotted on v-for content applies scope id before insertion', async () => {
    defineSlottedScopeProbe()
    slottedScopeProbeConnections.length = 0

    const count = ref(0)
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
              createFor(
                () => count.value,
                () =>
                  template(
                    '<slotted-scope-probe>item</slotted-scope-probe>',
                    1,
                  )(),
              ),
          },
          true,
        )
      },
    }).render()

    count.value++
    await nextTick()

    expect(slottedScopeProbeConnections).toEqual([true])
    expect(html()).toBe(
      `<slotted-scope-probe child-s="">item</slotted-scope-probe><!--for--><!--slot-->`,
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

  test('vdom slot owner > vapor slot content preserves slot scopeIds on same root update', async () => {
    function mount(initialNoSlotted: boolean) {
      const noSlotted = ref(initialNoSlotted)
      const count = ref(0)
      const VaporChild = defineVaporComponent({
        props: {
          count: Number,
        },
        setup(props: any) {
          const n0 = template('<button></button>', 1)()
          renderEffect(() => setElementText(n0, props.count))
          return n0
        },
      })

      const VdomSlotOwner = {
        __scopeId: 'vdom-slot-owner',
        setup(_props: unknown, { slots }: any) {
          return () =>
            h(
              'div',
              null,
              renderSlot(slots, 'default', {}, undefined, noSlotted.value),
            )
        },
      }

      const VdomParent = {
        __scopeId: 'vdom-parent',
        setup() {
          return () =>
            h(VdomSlotOwner, null, {
              default: () => h(VaporChild as any, { count: count.value }),
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
      return { count, noSlotted, root }
    }

    const noSlottedRoot = mount(true)

    expect(noSlottedRoot.root.innerHTML).toBe(
      `<div vdom-slot-owner="" vdom-parent="">` +
        `<button vdom-parent="">0</button>` +
        `</div>`,
    )

    noSlottedRoot.noSlotted.value = false
    noSlottedRoot.count.value++
    await nextTick()

    expect(noSlottedRoot.root.innerHTML).toBe(
      `<div vdom-slot-owner="" vdom-parent="">` +
        `<button vdom-parent="">1</button>` +
        `</div>`,
    )

    const slottedRoot = mount(false)

    expect(slottedRoot.root.innerHTML).toBe(
      `<div vdom-slot-owner="" vdom-parent="">` +
        `<button vdom-parent="" vdom-slot-owner-s="">0</button>` +
        `</div>`,
    )

    slottedRoot.noSlotted.value = true
    slottedRoot.count.value++
    await nextTick()

    expect(slottedRoot.root.innerHTML).toBe(
      `<div vdom-slot-owner="" vdom-parent="">` +
        `<button vdom-parent="" vdom-slot-owner-s="">1</button>` +
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

  test('should apply a newly added VDOM scopeId to a future interop root', async () => {
    const scopeId = ref<string | null>(null)
    const showAlt = ref(false)
    const VdomChild = {
      __scopeId: 'vdom-child',
      setup() {
        return () => (showAlt.value ? h('section', 'alt') : h('div', 'base'))
      },
    }
    const VaporChild = defineVaporComponent({
      setup() {
        return createComponent(VdomChild as any, null, null, true)
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
    expect(root.innerHTML).toBe(`<div vdom-child="">base</div>`)

    scopeId.value = 'added'
    await nextTick()
    expect(root.innerHTML).toBe(`<div vdom-child="">base</div>`)

    showAlt.value = true
    await nextTick()
    expect(root.innerHTML).toBe(`<section vdom-child="" added="">alt</section>`)
    app.unmount()
  })

  test('applies a newly added VDOM scopeId to a future Vapor dynamic root', async () => {
    const scopeId = ref<string | null>(null)
    const showAlt = ref(false)
    const VaporChild = defineVaporComponent({
      setup() {
        return createIf(
          () => showAlt.value,
          () => template('<section>alt</section>')(),
          () => template('<div>base</div>')(),
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
    expect(root.innerHTML).toBe(`<div>base</div><!--if-->`)

    scopeId.value = 'added'
    await nextTick()
    expect(root.innerHTML).toBe(`<div>base</div><!--if-->`)

    showAlt.value = true
    await nextTick()
    expect(root.innerHTML).toBe(`<section added="">alt</section><!--if-->`)

    app.unmount()
  })

  test('preserves nearest Vapor scopeId contributions after an outer VDOM update', async () => {
    const scopeId = ref('outer-a')
    const showAlt = ref(false)
    const VdomChild = {
      __scopeId: 'vdom-child',
      setup() {
        return () => (showAlt.value ? h('section', 'alt') : h('div', 'base'))
      },
    }
    const Middle = defineVaporComponent({
      __scopeId: 'middle-vapor',
      setup() {
        return createComponent(VdomChild as any, null, null, true)
      },
    })
    const Outer = defineVaporComponent({
      __scopeId: 'outer-vapor',
      setup() {
        return createComponent(Middle, null, null, true)
      },
    })
    const App = {
      setup() {
        return () => {
          const child = h(Outer as any)
          child.scopeId = scopeId.value
          return child
        }
      },
    }

    const root = document.createElement('div')
    const app = createApp(App).use(vaporInteropPlugin)
    app.mount(root)
    expect(root.firstElementChild).toMatchObject({
      tagName: 'DIV',
    })
    expect(root.firstElementChild!.hasAttribute('vdom-child')).toBe(true)
    expect(root.firstElementChild!.hasAttribute('middle-vapor')).toBe(true)
    expect(root.firstElementChild!.hasAttribute('outer-vapor')).toBe(true)
    expect(root.firstElementChild!.hasAttribute('outer-a')).toBe(true)

    scopeId.value = 'outer-b'
    await nextTick()
    showAlt.value = true
    await nextTick()

    expect(root.firstElementChild).toMatchObject({
      tagName: 'SECTION',
    })
    expect(root.firstElementChild!.hasAttribute('vdom-child')).toBe(true)
    expect(root.firstElementChild!.hasAttribute('middle-vapor')).toBe(true)
    expect(root.firstElementChild!.hasAttribute('outer-vapor')).toBe(true)
    expect(root.firstElementChild!.hasAttribute('outer-b')).toBe(true)
    expect(root.firstElementChild!.hasAttribute('outer-a')).toBe(false)

    app.unmount()
  })

  test('does not apply root-only component scopeId to VDOM slot content', async () => {
    const showAlt = ref(false)
    const VaporChild = defineVaporComponent({
      setup() {
        return createSlot('default') as any
      },
    })
    const App = {
      setup() {
        return () => {
          const child = h(VaporChild as any, null, {
            default: () =>
              showAlt.value ? h('section', 'alt') : h('div', 'base'),
          })
          child.scopeId = 'external'
          return child
        }
      },
    }

    const root = document.createElement('div')
    const app = createApp(App).use(vaporInteropPlugin)
    app.mount(root)
    expect(root.innerHTML).toBe(`<div>base</div>`)

    showAlt.value = true
    await nextTick()
    expect(root.innerHTML).toBe(`<section>alt</section>`)

    app.unmount()
  })

  test('does not apply root-only component scopeId to an interop slot fallback created later', async () => {
    const show = ref(true)
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
    const App = {
      setup() {
        return () => {
          const child = h(VaporChild as any, null, {
            default: () => (show.value ? h('div', 'content') : []),
          })
          child.scopeId = 'external'
          return child
        }
      },
    }

    const root = document.createElement('div')
    const app = createApp(App).use(vaporInteropPlugin)
    app.mount(root)
    expect(root.innerHTML).toBe(`<div>content</div>`)

    show.value = false
    await nextTick()
    expect(root.innerHTML).toBe(`<span>fallback</span>`)

    app.unmount()
  })

  test('does not apply root-only component scopeId to VDOM slot fallback created later', async () => {
    const show = ref(true)
    const VDomOutlet = {
      setup(_: unknown, { slots }: any) {
        return () =>
          renderSlot(slots, 'default', {}, () => [h('span', 'fallback')])
      },
    }
    const VaporChild = defineVaporComponent({
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
    })
    const App = {
      setup() {
        return () => {
          const child = h(VaporChild as any, null, {
            default: () => (show.value ? h('div', 'content') : []),
          })
          child.scopeId = 'external'
          return child
        }
      },
    }

    const root = document.createElement('div')
    const app = createApp(App).use(vaporInteropPlugin)
    app.mount(root)
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

  test('uses current scopeId for a cached component future root', async () => {
    const active = ref(true)
    const scopeId = ref('first')
    const showAlt = ref(false)
    const VaporChild = defineVaporComponent({
      setup() {
        return createIf(
          () => showAlt.value,
          () => template('<section>alt</section>')(),
          () => template('<div>base</div>')(),
        )
      },
    })
    const Other = {
      setup() {
        return () => h('p', 'other')
      },
    }
    const App = {
      setup() {
        return () =>
          h(KeepAlive, null, {
            default: () => {
              if (!active.value) return h(Other)
              const child = h(VaporChild as any)
              child.scopeId = scopeId.value
              return child
            },
          })
      },
    }
    const root = document.createElement('div')
    const app = createApp(App).use(vaporInteropPlugin)
    app.mount(root)
    expect(root.innerHTML).toBe(`<div first="">base</div><!--if-->`)

    active.value = false
    await nextTick()
    scopeId.value = 'second'
    active.value = true
    await nextTick()
    showAlt.value = true
    await nextTick()

    expect(root.innerHTML).toBe(`<section second="">alt</section><!--if-->`)
    app.unmount()
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

  test('does not apply component scopeId to VDOM Teleport children', () => {
    const target = document.createElement('div')
    document.body.appendChild(target)
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
    const App = {
      __scopeId: 'external',
      setup() {
        return () => h(VaporChild as any)
      },
    }

    const root = document.createElement('div')
    const app = createApp(App).use(vaporInteropPlugin)
    app.mount(root)

    expect(target.firstElementChild!.hasAttribute('external')).toBe(false)
    app.unmount()
    target.remove()
  })

  test('applies slotted scopeId to VDOM Teleport children', () => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    const Receiver = defineVaporComponent({
      __scopeId: 'receiver',
      setup() {
        return createSlot('default', null, undefined, VaporSlotFlags.SLOT_ROOT)
      },
    })
    const App = {
      setup() {
        return () =>
          h(Receiver as any, null, {
            default: () => h(Teleport, { to: target }, h('div')),
          })
      },
    }

    const root = document.createElement('div')
    const app = createApp(App).use(vaporInteropPlugin)
    app.mount(root)

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

    const { html } = define(Parent).render()
    expect(html()).toContain('fb')
    expect(html()).toContain('child-s')

    data.value = true
    await nextTick()
    // content parked behind the active fallback still received the slot's
    // ids, so re-exposing it yields the same DOM as VDOM (<em child-s>)
    expect(html()).toContain('<em')
    expect(html()).toContain('child-s')
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

    const mountPair = (
      makeSide: (vapor: boolean) => any,
    ): { vdomHost: HTMLElement; host: HTMLElement } => {
      const vdomHost = document.createElement('div')
      createApp(makeSide(false)).mount(vdomHost)
      const host = document.createElement('div')
      createVaporApp(makeSide(true)).mount(host)
      return { vdomHost, host }
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

    test('slotted id reaches nested elements of slot content', () => {
      const { vdomHost, host } = mountPair(
        makeSides(
          `<template><components.Receiver><div><span>x</span></div></components.Receiver></template>`,
        ),
      )
      expect(strip(host.innerHTML)).toBe(strip(vdomHost.innerHTML))
      expect(strip(host.innerHTML)).toContain('<span receiver-s="">x</span>')
    })

    test('component in slot content: root inherits, internals do not', () => {
      const { vdomHost, host } = mountPair(
        makeSides(
          `<template><components.Receiver><div><components.Comp/></div></components.Receiver></template>`,
          { components: { Comp: `<template><b><u>x</u></b></template>` } },
        ),
      )
      expect(strip(host.innerHTML)).toBe(strip(vdomHost.innerHTML))
    })

    test('v-if branch inside slot content revealed after mount', async () => {
      const data = ref(false)
      const { vdomHost, host } = mountPair(
        makeSides(
          `<template><components.Receiver><div v-if="data"><span>x</span></div></components.Receiver></template>`,
          { data },
        ),
      )
      data.value = true
      await nextTick()
      expect(strip(host.innerHTML)).toBe(strip(vdomHost.innerHTML))
      expect(strip(host.innerHTML)).toContain('receiver-s')
    })

    test('v-for items added after mount carry ids at depth', async () => {
      const data = ref(0)
      const { vdomHost, host } = mountPair(
        makeSides(
          `<template><components.Receiver><div v-for="i in data"><span>{{ i }}</span></div></components.Receiver></template>`,
          { data },
        ),
      )
      data.value = 2
      await nextTick()
      expect(strip(host.innerHTML)).toBe(strip(vdomHost.innerHTML))
      expect(strip(host.innerHTML)).toContain('receiver-s')
    })

    test('fallback content carries ids at depth', () => {
      const { vdomHost, host } = mountPair(
        makeSides(`<template><components.Receiver/></template>`, {
          receiver: `<template><slot><div><span>fb</span></div></slot></template>`,
        }),
      )
      expect(strip(host.innerHTML)).toBe(strip(vdomHost.innerHTML))
      expect(strip(host.innerHTML)).toContain('receiver-s')
    })
  })

  test('applies a slot scope context change to a vdom component inside element-backed interop content', async () => {
    // the kept slot content is an element-backed interop subtree; a vdom
    // component inside it swaps its root after the context change and must
    // inherit the fresh ids, like a VDOM subtree patched with them.
    const run = async (vapor: boolean) => {
      const noSlotted = ref(true)
      const useB = ref(false)
      const VdomInner = defineComponent({
        setup() {
          return () => (useB.value ? h('span', 'B') : h('em', 'A'))
        },
      })
      const SlotOwner = {
        __scopeId: 'owner',
        setup(_: any, { slots }: any) {
          return () =>
            h(
              'div',
              null,
              renderSlot(slots, 'default', {}, undefined, noSlotted.value),
            )
        },
      }
      const VaporParent = defineVaporComponent({
        setup() {
          return createComponent(
            SlotOwner as any,
            null,
            {
              default: () =>
                createDynamicComponent(() => h('div', null, [h(VdomInner)])),
            },
            true,
          )
        },
      })
      const VdomParent = {
        setup() {
          return () =>
            h(SlotOwner, null, {
              default: () => [h('div', null, [h(VdomInner)])],
            })
        },
      }
      const root = document.createElement('div')
      const app = createApp({
        render: () => h((vapor ? VaporParent : VdomParent) as any),
      }).use(vaporInteropPlugin)
      app.mount(root)

      // context changes from no id to owner-s with the same slot function
      noSlotted.value = false
      await nextTick()
      // the vdom component inside the element-backed subtree swaps its root
      useB.value = true
      await nextTick()
      const span = root.querySelector('span')!
      expect(span).toBeTruthy()
      const has = span.hasAttribute('owner-s')
      app.unmount()
      return has
    }
    const vdom = await run(false)
    expect(await run(true)).toBe(vdom)
    expect(vdom).toBe(true)
  })

  test('applies inherited root-only scope id to the interop element root before insertion', () => {
    // insertion-time observers (custom element connectedCallback, transition
    // enter hooks) must already see the id, like VDOM stamping it in
    // mountElement before hostInsert
    defineExternalScopeProbe()
    externalScopeProbeConnections.length = 0
    const VaporChild = defineVaporComponent({
      setup() {
        return createDynamicComponent(
          () => h('external-scope-probe'),
          null,
          null,
          VaporDynamicComponentFlags.SINGLE_ROOT,
        )
      },
    })
    const mountSide = (vapor: boolean) => {
      const root = document.createElement('div')
      document.body.appendChild(root)
      const app = createApp({
        __scopeId: 'external',
        render: () =>
          vapor ? h(VaporChild as any) : h('external-scope-probe'),
      })
      if (vapor) app.use(vaporInteropPlugin)
      app.mount(root)
      app.unmount()
      root.remove()
    }
    // VDOM control: connectedCallback observes the id present
    mountSide(false)
    expect(externalScopeProbeConnections).toEqual([true])
    mountSide(true)
    expect(externalScopeProbeConnections).toEqual([true, true])
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
  describe('slot scope context transition matrix', () => {
    const flushPromises = () => new Promise(r => setTimeout(r))

    const runCell = async (
      shape: 'direct' | 'vnodeComp' | 'elementWrapped',
      inner: 'dynRoot' | 'suspense',
      vapor: boolean,
      initialNoSlotted: boolean,
    ) => {
      const noSlotted = ref(initialNoSlotted)
      const useSection = ref(false)
      let resolveGate!: () => void
      const gate = new Promise<void>(r => (resolveGate = r))

      const renderInnerRoot = () =>
        h(useSection.value ? 'section' : 'p', useSection.value ? 'B' : 'A')
      const AsyncInner = defineComponent({
        async setup() {
          await gate
          return () => h('section', 'resolved')
        },
      })
      const renderSuspense = () =>
        h(Suspense, null, {
          default: () => h(AsyncInner),
          fallback: () => h('p', 'loading'),
        })
      const innerRender = inner === 'dynRoot' ? renderInnerRoot : renderSuspense

      const VaporInner = defineVaporComponent({
        setup() {
          return createDynamicComponent(innerRender)
        },
      })
      const VdomInner = defineComponent({
        setup() {
          return innerRender
        },
      })
      const Inner: any = vapor ? VaporInner : VdomInner

      const vaporContent = {
        direct: () => createComponent(Inner),
        vnodeComp: () => createDynamicComponent(() => h(Inner)),
        elementWrapped: () =>
          createDynamicComponent(() => h('div', null, [h(Inner)])),
      }[shape]
      const vdomContent = {
        direct: () => [h(Inner)],
        vnodeComp: () => [h(Inner)],
        elementWrapped: () => [h('div', null, [h(Inner)])],
      }[shape]

      const SlotOwner = {
        __scopeId: 'owner',
        setup(_: any, { slots }: any) {
          return () =>
            h(
              'div',
              null,
              renderSlot(slots, 'default', {}, undefined, noSlotted.value),
            )
        },
      }
      const VaporParent = defineVaporComponent({
        setup() {
          return createComponent(
            SlotOwner as any,
            null,
            { default: vaporContent },
            true,
          )
        },
      })
      const VdomParent = {
        setup() {
          return () => h(SlotOwner, null, { default: vdomContent })
        },
      }

      const root = document.createElement('div')
      const app = createApp({
        render: () => h((vapor ? VaporParent : VdomParent) as any),
      }).use(vaporInteropPlugin)
      app.mount(root)

      // context transition with the same slot function
      noSlotted.value = !initialNoSlotted
      await nextTick()

      // the already-mounted root must keep its mount-time state
      const existing = root.querySelector('p')!
      expect(existing).toBeTruthy()
      const existingHas = existing.hasAttribute('owner-s')

      // materialize a new root after the transition
      if (inner === 'dynRoot') {
        useSection.value = true
        await nextTick()
      } else {
        resolveGate()
        await flushPromises()
        await nextTick()
      }
      const fresh = root.querySelector('section')!
      expect(fresh).toBeTruthy()
      const freshHas = fresh.hasAttribute('owner-s')
      app.unmount()
      return { existingHas, freshHas }
    }

    for (const shape of ['direct', 'vnodeComp', 'elementWrapped'] as const) {
      for (const inner of ['dynRoot', 'suspense'] as const) {
        for (const initialNoSlotted of [true, false] as const) {
          const dir = initialNoSlotted ? 'none -> id' : 'id -> none'
          test(`${shape} / ${inner} / ${dir}`, async () => {
            const vdom = await runCell(shape, inner, false, initialNoSlotted)
            const vapor = await runCell(shape, inner, true, initialNoSlotted)
            expect(vapor).toEqual(vdom)
          })
        }
      }
    }
  })

  test('applies an added slot scope context through nested vapor component roots', async () => {
    const run = async (vapor: boolean) => {
      const noSlotted = ref(true)
      const show = ref(false)
      const VaporLeaf = defineVaporComponent({
        setup() {
          return createIf(
            () => show.value,
            () => template('<section>content</section>', 1)(),
          )
        },
      })
      const VaporMiddle = defineVaporComponent({
        setup() {
          return createComponent(VaporLeaf, null, null, true)
        },
      })
      const VdomLeaf = defineComponent({
        setup() {
          return () => (show.value ? h('section', 'content') : null)
        },
      })
      const VdomMiddle = defineComponent({
        setup() {
          return () => h(VdomLeaf)
        },
      })
      const SlotOwner = {
        __scopeId: 'owner',
        setup(_: any, { slots }: any) {
          return () =>
            h(
              'div',
              null,
              renderSlot(slots, 'default', {}, undefined, noSlotted.value),
            )
        },
      }
      const VaporParent = defineVaporComponent({
        setup() {
          return createComponent(
            SlotOwner as any,
            null,
            { default: () => createComponent(VaporMiddle, null, null, true) },
            true,
          )
        },
      })
      const VdomParent = defineComponent({
        setup() {
          return () => h(SlotOwner, null, { default: () => [h(VdomMiddle)] })
        },
      })
      const root = document.createElement('div')
      const app = createApp({
        render: () => h((vapor ? VaporParent : VdomParent) as any),
      }).use(vaporInteropPlugin)
      app.mount(root)

      noSlotted.value = false
      await nextTick()
      show.value = true
      await nextTick()
      const hasScopeId = root.querySelector('section')!.hasAttribute('owner-s')
      app.unmount()
      return hasScopeId
    }

    expect(await run(false)).toBe(true)
    expect(await run(true)).toBe(true)
  })

  test('matches VDOM slotted scopeId for a late branch inside a static element', async () => {
    const run = async (vapor: boolean) => {
      const show = ref(false)
      const source = (template: string) =>
        vapor
          ? template
          : `<script setup>const data = _data; const components = _components;</script>${template}`
      const Receiver = compile(
        source(`<template><slot /></template>`),
        show,
        {},
        { vapor },
      )
      Receiver.__scopeId = 'receiver'
      const Parent = compile(
        source(
          `<template><components.Receiver><div><span v-if="data">late</span></div></components.Receiver></template>`,
        ),
        show,
        { Receiver },
        { vapor },
      )
      const root = document.createElement('div')
      ;(vapor ? createVaporApp(Parent) : createApp(Parent)).mount(root)

      show.value = true
      await nextTick()
      return root.querySelector('span')!.hasAttribute('receiver-s')
    }

    expect(await run(false)).toBe(true)
    expect(await run(true)).toBe(true)
  })

  test('matches VDOM slotted scopeId for a component future root inside a static element', async () => {
    const run = async (vapor: boolean) => {
      const show = ref(false)
      const source = (template: string) =>
        vapor
          ? template
          : `<script setup>const data = _data; const components = _components;</script>${template}`
      const Receiver = compile(
        source(`<template><slot /></template>`),
        show,
        {},
        { vapor },
      )
      Receiver.__scopeId = 'receiver'
      const Inner = compile(
        source(
          `<template><span v-if="data"><u>late</u></span><i v-else>initial</i></template>`,
        ),
        show,
        {},
        { vapor },
      )
      const Parent = compile(
        source(
          `<template><components.Receiver><div><components.Inner /></div></components.Receiver></template>`,
        ),
        show,
        { Receiver, Inner },
        { vapor },
      )
      const root = document.createElement('div')
      ;(vapor ? createVaporApp(Parent) : createApp(Parent)).mount(root)

      show.value = true
      await nextTick()
      return {
        root: root.querySelector('span')!.hasAttribute('receiver-s'),
        child: root.querySelector('u')!.hasAttribute('receiver-s'),
      }
    }

    expect(await run(false)).toEqual({ root: true, child: false })
    expect(await run(true)).toEqual({ root: true, child: false })
  })

  test('matches VDOM slotted scopeId for a late v-for item inside a static element', async () => {
    const run = async (vapor: boolean) => {
      const count = ref(0)
      const source = (template: string) =>
        vapor
          ? template
          : `<script setup>const data = _data; const components = _components;</script>${template}`
      const Receiver = compile(
        source(`<template><slot /></template>`),
        count,
        {},
        { vapor },
      )
      Receiver.__scopeId = 'receiver'
      const Parent = compile(
        source(
          `<template><components.Receiver><div><span v-for="i in data">late</span></div></components.Receiver></template>`,
        ),
        count,
        { Receiver },
        { vapor },
      )
      const root = document.createElement('div')
      ;(vapor ? createVaporApp(Parent) : createApp(Parent)).mount(root)

      count.value++
      await nextTick()
      return root.querySelector('span')!.hasAttribute('receiver-s')
    }

    expect(await run(false)).toBe(true)
    expect(await run(true)).toBe(true)
  })

  test.each([
    [true, false],
    [false, true],
  ])(
    'matches VDOM slotted scopeId after a kept slot context changes from %s to %s',
    async (initialNoSlotted, nextNoSlotted) => {
      const run = async (vapor: boolean) => {
        const show = ref(false)
        const noSlotted = ref(initialNoSlotted)
        const SlotOwner = defineComponent({
          __scopeId: 'owner',
          setup(_props, { slots }) {
            return () =>
              h(
                'div',
                null,
                renderSlot(
                  slots,
                  'default',
                  {},
                  () => [h('i', 'fallback')],
                  noSlotted.value,
                ),
              )
          },
        })
        const source = vapor
          ? `<template><components.SlotOwner><section v-if="data">content</section></components.SlotOwner></template>`
          : `<script setup>const data = _data; const components = _components;</script><template><components.SlotOwner><section v-if="data">content</section></components.SlotOwner></template>`
        const Parent = compile(source, show, { SlotOwner }, { vapor })
        const root = document.createElement('div')
        const app = vapor ? createVaporApp(Parent) : createApp(Parent)
        if (vapor) app.use(vaporInteropPlugin)
        app.mount(root)

        noSlotted.value = nextNoSlotted
        await nextTick()
        show.value = true
        await nextTick()
        const result = root.querySelector('section')!.hasAttribute('owner-s')
        app.unmount()
        return result
      }

      const expected = await run(false)
      expect(expected).toBe(!nextNoSlotted)
      expect(await run(true)).toBe(expected)
    },
  )

  test('keeps equal slotted scopeId contributions from independent slot outlets', async () => {
    const run = async (vapor: boolean) => {
      const noSlotted = ref(false)
      const showAlt = ref(false)
      const Outer = defineComponent({
        __scopeId: 'same',
        setup(_props, { slots }) {
          return () =>
            h(
              'div',
              null,
              renderSlot(slots, 'default', {}, undefined, noSlotted.value),
            )
        },
      })
      const source = vapor
        ? `<template><components.Outer><slot /></components.Outer></template>`
        : `<script setup>const components = _components;</script><template><components.Outer><slot /></components.Outer></template>`
      const Forwarder = compile(source, ref(null), { Outer }, { vapor })
      Forwarder.__scopeId = 'same'
      const stableSlot = () =>
        showAlt.value ? [h('span', 'new')] : [h('p', 'old')]
      const App = defineComponent({
        setup() {
          return () => {
            showAlt.value
            return h(Forwarder as any, null, { default: stableSlot })
          }
        },
      })
      const root = document.createElement('div')
      const app = createApp(App)
      if (vapor) app.use(vaporInteropPlugin)
      app.mount(root)

      noSlotted.value = true
      await nextTick()
      showAlt.value = true
      await nextTick()
      const result = root.querySelector('span')!.hasAttribute('same-s')
      app.unmount()
      return result
    }

    expect(await run(false)).toBe(true)
    expect(await run(true)).toBe(true)
  })

  test('matches VDOM slotted scopeId when reactivating a cached component', async () => {
    const run = async (vapor: boolean) => {
      const active = ref(true)
      const showAlt = ref(false)
      const noSlotted = ref(true)
      const source = (template: string) =>
        vapor
          ? template
          : `<script setup>const data = _data; const components = _components;</script>${template}`
      const Child = compile(
        source(
          `<template><section v-if="data">fresh</section><div v-else>cached</div></template>`,
        ),
        showAlt,
        {},
        { vapor },
      )
      const Other = compile(
        source(`<template><p>other</p></template>`),
        ref(),
        {},
        {
          vapor,
        },
      )
      const SlotOwner = defineComponent({
        __scopeId: 'owner',
        setup(_props, { slots }) {
          return () =>
            renderSlot(slots, 'default', {}, undefined, noSlotted.value)
        },
      })
      const Parent = compile(
        source(
          `<template>
            <components.SlotOwner>
              <components.KeepAliveImpl>
                <components.Child v-if="data" />
                <components.Other v-else />
              </components.KeepAliveImpl>
            </components.SlotOwner>
          </template>`,
        ),
        active,
        {
          SlotOwner,
          KeepAliveImpl: vapor ? VaporKeepAlive : KeepAlive,
          Child,
          Other,
        },
        { vapor },
      )
      const root = document.createElement('div')
      const app = vapor ? createVaporApp(Parent) : createApp(Parent)
      if (vapor) app.use(vaporInteropPlugin)
      app.mount(root)

      active.value = false
      await nextTick()
      noSlotted.value = false
      await nextTick()
      active.value = true
      await nextTick()
      const cached = root.querySelector('div')!.hasAttribute('owner-s')

      showAlt.value = true
      await nextTick()
      const fresh = root.querySelector('section')!.hasAttribute('owner-s')
      app.unmount()
      return { cached, fresh }
    }

    const expected = await run(false)
    expect(expected).toEqual({ cached: false, fresh: true })
    expect(await run(true)).toEqual(expected)
  })

  test('does not apply a nested forwarded outlet scopeId to receiver fallback', async () => {
    const run = async (vapor: boolean) => {
      const state = ref({ forward: true, content: true, alt: false })
      const Receiver = defineComponent({
        setup(_props, { slots }) {
          return () =>
            renderSlot(slots, 'default', {}, () => [
              h(state.value.alt ? 'section' : 'i', 'fallback'),
            ])
        },
      })
      const source = vapor
        ? `<template><components.Receiver><slot v-if="data.forward" /></components.Receiver></template>`
        : `<script setup>const data = _data; const components = _components;</script><template><components.Receiver><slot v-if="data.forward" /></components.Receiver></template>`
      const Forwarder = compile(source, state, { Receiver }, { vapor })
      Forwarder.__scopeId = 'forwarder'
      const root = document.createElement('div')
      const slot = () => (state.value.content ? [h('p', 'content')] : [])
      const app = createApp({
        render() {
          state.value.content
          return h(Forwarder, null, { default: slot })
        },
      })
      if (vapor) app.use(vaporInteropPlugin)
      app.mount(root)

      const content = root.querySelector('p')!.hasAttribute('forwarder-s')
      state.value = { forward: false, content: false, alt: false }
      await nextTick()
      const fallback = root.querySelector('i')!.hasAttribute('forwarder-s')
      state.value = { forward: false, content: false, alt: true }
      await nextTick()
      const fresh = root.querySelector('section')!.hasAttribute('forwarder-s')
      app.unmount()
      return { content, fallback, fresh }
    }

    const expected = await run(false)
    expect(expected).toEqual({
      content: true,
      fallback: false,
      fresh: false,
    })
    expect(await run(true)).toEqual(expected)
  })

  test('does not apply a nested forwarded outlet scopeId to its static wrapper', () => {
    const run = (vapor: boolean) => {
      const Receiver = defineComponent({
        setup(_props, { slots }) {
          return () => renderSlot(slots, 'default')
        },
      })
      const source = vapor
        ? `<template><components.Receiver><div><slot /></div></components.Receiver></template>`
        : `<script setup>const components = _components;</script><template><components.Receiver><div><slot /></div></components.Receiver></template>`
      const Forwarder = compile(source, ref(), { Receiver }, { vapor })
      Forwarder.__scopeId = 'forwarder'
      const root = document.createElement('div')
      const app = createApp({
        render: () =>
          h(Forwarder, null, { default: () => [h('p', 'content')] }),
      })
      if (vapor) app.use(vaporInteropPlugin)
      app.mount(root)

      const result = {
        wrapper: root.querySelector('div')!.hasAttribute('forwarder-s'),
        content: root.querySelector('p')!.hasAttribute('forwarder-s'),
      }
      app.unmount()
      return result
    }

    const expected = run(false)
    expect(expected).toEqual({ wrapper: false, content: true })
    expect(run(true)).toEqual(expected)
  })
})
