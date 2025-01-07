import {
  Fragment,
  Suspense,
  createBlock,
  createCommentVNode,
  createVNode,
  defineComponent,
  h,
  nextTick,
  nodeOps,
  openBlock,
  popScopeId,
  pushScopeId,
  ref,
  render,
  renderSlot,
  serializeInner,
  withScopeId,
} from '@vue/runtime-test'
import { withCtx } from '../src/componentRenderContext'
import { PatchFlags } from '@vue/shared'

describe('scopeId runtime support', () => {
  test('should attach scopeId', () => {
    const App = {
      __scopeId: 'parent',
      render: () => h('div', [h('div')]),
    }
    const root = nodeOps.createElement('div')
    render(h(App), root)
    expect(serializeInner(root)).toBe(`<div parent><div parent></div></div>`)
  })

  test('should attach scopeId to components in parent component', () => {
    const Child = {
      __scopeId: 'child',
      render: () => h('div'),
    }
    const App = {
      __scopeId: 'parent',
      render: () => h('div', [h(Child)]),
    }

    const root = nodeOps.createElement('div')
    render(h(App), root)
    expect(serializeInner(root)).toBe(
      `<div parent><div child parent></div></div>`,
    )
  })

  // #5148
  test('should attach scopeId to suspense content', async () => {
    const deps: Promise<any>[] = []
    const Child = {
      async setup() {
        const p = new Promise(r => setTimeout(r, 1))
        deps.push(p.then(() => Promise.resolve()))

        await p
        return () => h('div', 'async')
      },
    }

    const Wrapper = {
      setup(_: any, { slots }: any) {
        return () => slots.default({ Component: h(Child) })
      },
    }

    const App = {
      __scopeId: 'parent',
      setup() {
        return () =>
          h(Wrapper, null, {
            default: withCtx(({ Component }: any) =>
              h(Suspense, null, {
                default: h(Component),
                fallback: h('div', 'fallback'),
              }),
            ),
          })
      },
    }

    const root = nodeOps.createElement('div')
    render(h(App), root)
    expect(serializeInner(root)).toBe(`<div parent>fallback</div>`)

    await Promise.all(deps)
    await nextTick()
    expect(serializeInner(root)).toBe(`<div parent>async</div>`)
  })

  // :slotted basic
  test('should work on slots', () => {
    const Child = {
      __scopeId: 'child',
      render(this: any) {
        return h('div', renderSlot(this.$slots, 'default'))
      },
    }
    const Child2 = {
      __scopeId: 'child2',
      render: () => h('span'),
    }
    const App = {
      __scopeId: 'parent',
      render: () => {
        return h(
          Child,
          withCtx(() => {
            return [h('div'), h(Child2)]
          }),
        )
      },
    }
    const root = nodeOps.createElement('div')
    render(h(App), root)
    // slot content should have:
    // - scopeId from parent
    // - slotted scopeId (with `-s` postfix) from child (the tree owner)
    expect(serializeInner(root)).toBe(
      `<div child parent>` +
        `<div parent child-s></div>` +
        // component inside slot should have:
        // - scopeId from template context
        // - slotted scopeId from slot owner
        // - its own scopeId
        `<span child2 parent child-s></span>` +
        `</div>`,
    )
  })

  // #2892
  test(':slotted on forwarded slots', async () => {
    const Wrapper = {
      __scopeId: 'wrapper',
      render(this: any) {
        // <div class="wrapper"><slot/></div>
        return h('div', { class: 'wrapper' }, [
          renderSlot(
            this.$slots,
            'default',
            {},
            undefined,
            true /* noSlotted */,
          ),
        ])
      },
    }

    const Slotted = {
      __scopeId: 'slotted',
      render(this: any) {
        // <Wrapper><slot/></Wrapper>
        return h(Wrapper, null, {
          default: withCtx(() => [renderSlot(this.$slots, 'default')]),
        })
      },
    }

    // simulate hoisted node
    pushScopeId('root')
    const hoisted = h('div', 'hoisted')
    popScopeId()

    const Root = {
      __scopeId: 'root',
      render(this: any) {
        // <Slotted><div>hoisted</div><div>{{ dynamic }}</div></Slotted>
        return h(Slotted, null, {
          default: withCtx(() => {
            return [hoisted, h('div', 'dynamic')]
          }),
        })
      },
    }

    const root = nodeOps.createElement('div')
    render(h(Root), root)
    expect(serializeInner(root)).toBe(
      `<div wrapper slotted root class="wrapper">` +
        `<div root slotted-s>hoisted</div>` +
        `<div root slotted-s>dynamic</div>` +
        `</div>`,
    )

    const Root2 = {
      __scopeId: 'root',
      render(this: any) {
        // <Slotted>
        //  <Wrapper>
        //    <div>hoisted</div><div>{{ dynamic }}</div>
        //  </Wrapper>
        // </Slotted>
        return h(Slotted, null, {
          default: withCtx(() => [
            h(Wrapper, null, {
              default: withCtx(() => [hoisted, h('div', 'dynamic')]),
            }),
          ]),
        })
      },
    }
    const root2 = nodeOps.createElement('div')
    render(h(Root2), root2)
    expect(serializeInner(root2)).toBe(
      `<div wrapper slotted root class="wrapper">` +
        `<div wrapper root slotted-s class="wrapper">` +
        `<div root>hoisted</div>` +
        `<div root>dynamic</div>` +
        `</div>` +
        `</div>`,
    )
  })

  // #1988
  test('should inherit scopeId through nested HOCs with inheritAttrs: false', () => {
    const App = {
      __scopeId: 'parent',
      render: () => {
        return h(Child)
      },
    }

    function Child() {
      return h(Child2, { class: 'foo' })
    }

    function Child2() {
      return h('div')
    }
    Child2.inheritAttrs = false

    const root = nodeOps.createElement('div')
    render(h(App), root)

    expect(serializeInner(root)).toBe(`<div parent></div>`)
  })

  test('should inherit scopeId through nested DEV_ROOT_FRAGMENT with inheritAttrs: false', async () => {
    const Parent = {
      __scopeId: 'parent',
      render() {
        return h(Child, { class: 'foo' })
      },
    }

    const ok = ref(true)
    const Child = defineComponent({
      inheritAttrs: false,
      render() {
        return (
          openBlock(),
          createBlock(
            Fragment,
            null,
            [
              createCommentVNode('comment1'),
              ok.value
                ? (openBlock(), createBlock('div', { key: 0 }, 'div1'))
                : (openBlock(),
                  createBlock(
                    Fragment,
                    { key: 1 },
                    [
                      createCommentVNode('comment2'),
                      createVNode('div', null, 'div2'),
                    ],
                    PatchFlags.STABLE_FRAGMENT | PatchFlags.DEV_ROOT_FRAGMENT,
                  )),
            ],
            PatchFlags.STABLE_FRAGMENT | PatchFlags.DEV_ROOT_FRAGMENT,
          )
        )
      },
    })

    const root = nodeOps.createElement('div')
    render(h(Parent), root)
    expect(serializeInner(root)).toBe(`<!--comment1--><div parent>div1</div>`)

    ok.value = false
    await nextTick()
    expect(serializeInner(root)).toBe(
      `<!--comment1--><!--comment2--><div parent>div2</div>`,
    )
  })
})

describe('backwards compat with <=3.0.7', () => {
  const withParentId = withScopeId('parent')
  const withChildId = withScopeId('child')

  test('should attach scopeId', () => {
    const App = {
      __scopeId: 'parent',
      render: withParentId(() => {
        return h('div', [h('div')])
      }),
    }
    const root = nodeOps.createElement('div')
    render(h(App), root)
    expect(serializeInner(root)).toBe(`<div parent><div parent></div></div>`)
  })

  test('should attach scopeId to components in parent component', () => {
    const Child = {
      __scopeId: 'child',
      render: withChildId(() => {
        return h('div')
      }),
    }
    const App = {
      __scopeId: 'parent',
      render: withParentId(() => {
        return h('div', [h(Child)])
      }),
    }

    const root = nodeOps.createElement('div')
    render(h(App), root)
    expect(serializeInner(root)).toBe(
      `<div parent><div child parent></div></div>`,
    )
  })

  test('should work on slots', () => {
    const Child = {
      __scopeId: 'child',
      render: withChildId(function (this: any) {
        return h('div', renderSlot(this.$slots, 'default'))
      }),
    }
    const withChild2Id = withScopeId('child2')
    const Child2 = {
      __scopeId: 'child2',
      render: withChild2Id(() => h('span')),
    }
    const App = {
      __scopeId: 'parent',
      render: withParentId(() => {
        return h(
          Child,
          withParentId(() => {
            return [h('div'), h(Child2)]
          }),
        )
      }),
    }
    const root = nodeOps.createElement('div')
    render(h(App), root)
    // slot content should have:
    // - scopeId from parent
    // - slotted scopeId (with `-s` postfix) from child (the tree owner)
    expect(serializeInner(root)).toBe(
      `<div child parent>` +
        `<div parent child-s></div>` +
        // component inside slot should have:
        // - scopeId from template context
        // - slotted scopeId from slot owner
        // - its own scopeId
        `<span child2 parent child-s></span>` +
        `</div>`,
    )
  })

  // #1988
  test('should inherit scopeId through nested HOCs with inheritAttrs: false', () => {
    const withParentId = withScopeId('parent')
    const App = {
      __scopeId: 'parent',
      render: withParentId(() => {
        return h(Child)
      }),
    }

    function Child() {
      return h(Child2, { class: 'foo' })
    }

    function Child2() {
      return h('div')
    }
    Child2.inheritAttrs = false

    const root = nodeOps.createElement('div')
    render(h(App), root)

    expect(serializeInner(root)).toBe(`<div parent></div>`)
  })

  test('hoisted nodes', async () => {
    pushScopeId('foobar')
    const hoisted = h('div', 'hello')
    popScopeId()

    const App = {
      __scopeId: 'foobar',
      render: () => h('div', [hoisted]),
    }

    const root = nodeOps.createElement('div')
    render(h(App), root)

    expect(serializeInner(root)).toBe(
      `<div foobar><div foobar>hello</div></div>`,
    )
  })
})
