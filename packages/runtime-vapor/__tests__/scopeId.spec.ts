import { createApp, h } from '@vue/runtime-dom'
import {
  createComponent,
  createDynamicComponent,
  createSlot,
  defineVaporComponent,
  setInsertionState,
  template,
  vaporInteropPlugin,
  withVaporCtx,
} from '../src'
import { makeRender } from './_utils'

const define = makeRender()

describe('scopeId', () => {
  test('should attach scopeId to child component', () => {
    const Child = defineVaporComponent({
      __scopeId: 'child',
      setup() {
        return template('<div child></div>', true)()
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

  test('should attach scopeId to child component with insertion state', () => {
    const Child = defineVaporComponent({
      __scopeId: 'child',
      setup() {
        return template('<div child></div>', true)()
      },
    })

    const { html } = define({
      __scopeId: 'parent',
      setup() {
        const t0 = template('<div parent></div>', true)
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
        return template('<div child></div>', true)()
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

  test('should not attach scopeId to nested multiple root components', () => {
    const Child = defineVaporComponent({
      __scopeId: 'child',
      setup() {
        return template('<div child></div>', true)()
      },
    })

    const Parent = defineVaporComponent({
      __scopeId: 'parent',
      setup() {
        const n0 = template('<div parent></div>')()
        const n1 = createComponent(Child)
        return [n0, n1]
      },
    })

    const { html } = define({
      __scopeId: 'app',
      setup() {
        return createComponent(Parent)
      },
    }).render()
    expect(html()).toBe(`<div parent=""></div><div child="" parent=""></div>`)
  })

  test('should attach scopeId to nested child component with insertion state', () => {
    const Child = defineVaporComponent({
      __scopeId: 'child',
      setup() {
        return template('<div child></div>', true)()
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
        const t0 = template('<div app></div>', true)
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
        const t0 = template('<div parent></div>', true)
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
        return createDynamicComponent(() => 'button', null, null, true)
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
        return createDynamicComponent(() => 'button', null, null, true)
      },
    })
    const { html } = define({
      __scopeId: 'parent',
      setup() {
        const t0 = template('<div parent></div>', true)
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
        const n1 = template('<div child></div>', true)() as any
        setInsertionState(n1)
        createSlot('default', null)
        return n1
      },
    })

    const Child2 = defineVaporComponent({
      __scopeId: 'child2',
      setup() {
        return template('<span child2></span>', true)()
      },
    })

    const { html } = define({
      __scopeId: 'parent',
      setup() {
        const n2 = createComponent(
          Child,
          null,
          {
            default: withVaporCtx(() => {
              const n0 = template('<div parent></div>')()
              const n1 = createComponent(Child2)
              return [n0, n1]
            }),
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
        `<span child2="" child-s="" parent=""></span>` +
        `<!--slot-->` +
        `</div>`,
    )
  })

  test(':slotted on forwarded slots', async () => {
    const Wrapper = defineVaporComponent({
      __scopeId: 'wrapper',
      setup() {
        // <div><slot/></div>
        const n1 = template('<div wrapper></div>', true)() as any
        setInsertionState(n1)
        createSlot('default', null, undefined, true /* noSlotted */)
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
            default: withVaporCtx(() => {
              const n0 = createSlot('default', null)
              return n0
            }),
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
            default: withVaporCtx(() => {
              return template('<div root></div>')()
            }),
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
})

describe('vdom interop', () => {
  test('vdom parent > vapor child', () => {
    const VaporChild = defineVaporComponent({
      __scopeId: 'vapor-child',
      setup() {
        return template('<button vapor-child></button>', true)()
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
        return createDynamicComponent(() => 'button', null, null, true)
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
        return template('<button vapor-child></button>', true)()
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
        return template('<button vapor-child></button>', true)()
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
        const n1 = template('<div vapor-slot></div>', true)() as any
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
            default: withVaporCtx(() => {
              const n0 = template('<div vapor-parent></div>')()
              const n1 = createComponent(VdomChild)
              return [n0, n1]
            }),
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
})
