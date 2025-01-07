import {
  Fragment,
  type FunctionalComponent,
  type SetupContext,
  Teleport,
  type TestElement,
  type VNode,
  createApp,
  createBlock,
  createCommentVNode,
  createElementBlock,
  createElementVNode,
  createTextVNode,
  createVNode,
  defineComponent,
  h,
  serializeInner as inner,
  nextTick,
  nodeOps,
  onBeforeMount,
  onBeforeUnmount,
  onUnmounted,
  openBlock,
  ref,
  render,
  renderList,
  renderSlot,
  serialize,
  setBlockTracking,
  withCtx,
} from '@vue/runtime-test'
import { PatchFlags, SlotFlags } from '@vue/shared'
import { SuspenseImpl } from '../src/components/Suspense'

describe('renderer: optimized mode', () => {
  let root: TestElement
  let block: VNode | null = null

  beforeEach(() => {
    root = nodeOps.createElement('div')
    block = null
  })

  const renderWithBlock = (renderChildren: () => VNode[]) => {
    render(
      (openBlock(), (block = createBlock('div', null, renderChildren()))),
      root,
    )
  }

  test('basic use of block', () => {
    render((openBlock(), (block = createBlock('p', null, 'foo'))), root)

    expect(block.dynamicChildren!.length).toBe(0)
    expect(inner(root)).toBe('<p>foo</p>')
  })

  test('block can appear anywhere in the vdom tree', () => {
    render(
      h('div', (openBlock(), (block = createBlock('p', null, 'foo')))),
      root,
    )

    expect(block.dynamicChildren!.length).toBe(0)
    expect(inner(root)).toBe('<div><p>foo</p></div>')
  })

  test('block should collect dynamic vnodes', () => {
    renderWithBlock(() => [
      createVNode('p', null, 'foo', PatchFlags.TEXT),
      createVNode('i'),
    ])

    expect(block!.dynamicChildren!.length).toBe(1)
    expect(serialize(block!.dynamicChildren![0].el as TestElement)).toBe(
      '<p>foo</p>',
    )
  })

  test('block can disable tracking', () => {
    render(
      // disable tracking
      (openBlock(true),
      (block = createBlock('div', null, [
        createVNode('p', null, 'foo', PatchFlags.TEXT),
      ]))),
      root,
    )

    expect(block.dynamicChildren!.length).toBe(0)
  })

  test('block as dynamic children', () => {
    renderWithBlock(() => [
      (openBlock(), createBlock('div', { key: 0 }, [h('p')])),
    ])

    expect(block!.dynamicChildren!.length).toBe(1)
    expect(block!.dynamicChildren![0].dynamicChildren!.length).toBe(0)
    expect(serialize(block!.dynamicChildren![0].el as TestElement)).toBe(
      '<div><p></p></div>',
    )

    renderWithBlock(() => [
      (openBlock(), createBlock('div', { key: 1 }, [h('i')])),
    ])

    expect(block!.dynamicChildren!.length).toBe(1)
    expect(block!.dynamicChildren![0].dynamicChildren!.length).toBe(0)
    expect(serialize(block!.dynamicChildren![0].el as TestElement)).toBe(
      '<div><i></i></div>',
    )
  })

  test('PatchFlags: PatchFlags.TEXT', async () => {
    renderWithBlock(() => [createVNode('p', null, 'foo', PatchFlags.TEXT)])

    expect(inner(root)).toBe('<div><p>foo</p></div>')
    expect(block!.dynamicChildren!.length).toBe(1)
    expect(serialize(block!.dynamicChildren![0].el as TestElement)).toBe(
      '<p>foo</p>',
    )

    renderWithBlock(() => [createVNode('p', null, 'bar', PatchFlags.TEXT)])

    expect(inner(root)).toBe('<div><p>bar</p></div>')
    expect(block!.dynamicChildren!.length).toBe(1)
    expect(serialize(block!.dynamicChildren![0].el as TestElement)).toBe(
      '<p>bar</p>',
    )
  })

  test('PatchFlags: PatchFlags.CLASS', async () => {
    renderWithBlock(() => [
      createVNode('p', { class: 'foo' }, '', PatchFlags.CLASS),
    ])

    expect(inner(root)).toBe('<div><p class="foo"></p></div>')
    expect(block!.dynamicChildren!.length).toBe(1)
    expect(serialize(block!.dynamicChildren![0].el as TestElement)).toBe(
      '<p class="foo"></p>',
    )

    renderWithBlock(() => [
      createVNode('p', { class: 'bar' }, '', PatchFlags.CLASS),
    ])

    expect(inner(root)).toBe('<div><p class="bar"></p></div>')
    expect(block!.dynamicChildren!.length).toBe(1)
    expect(serialize(block!.dynamicChildren![0].el as TestElement)).toBe(
      '<p class="bar"></p>',
    )
  })

  test('PatchFlags: PatchFlags.STYLE', async () => {
    renderWithBlock(() => [
      createVNode('p', { style: 'color: red' }, '', PatchFlags.STYLE),
    ])

    expect(inner(root)).toBe('<div><p style="color: red"></p></div>')
    expect(block!.dynamicChildren!.length).toBe(1)
    expect(serialize(block!.dynamicChildren![0].el as TestElement)).toBe(
      '<p style="color: red"></p>',
    )

    renderWithBlock(() => [
      createVNode('p', { style: 'color: green' }, '', PatchFlags.STYLE),
    ])

    expect(inner(root)).toBe('<div><p style="color: green"></p></div>')
    expect(block!.dynamicChildren!.length).toBe(1)
    expect(serialize(block!.dynamicChildren![0].el as TestElement)).toBe(
      '<p style="color: green"></p>',
    )
  })

  test('PatchFlags: PatchFlags.PROPS', async () => {
    renderWithBlock(() => [
      createVNode('p', { id: 'foo' }, '', PatchFlags.PROPS, ['id']),
    ])

    expect(inner(root)).toBe('<div><p id="foo"></p></div>')
    expect(block!.dynamicChildren!.length).toBe(1)
    expect(serialize(block!.dynamicChildren![0].el as TestElement)).toBe(
      '<p id="foo"></p>',
    )

    renderWithBlock(() => [
      createVNode('p', { id: 'bar' }, '', PatchFlags.PROPS, ['id']),
    ])

    expect(inner(root)).toBe('<div><p id="bar"></p></div>')
    expect(block!.dynamicChildren!.length).toBe(1)
    expect(serialize(block!.dynamicChildren![0].el as TestElement)).toBe(
      '<p id="bar"></p>',
    )
  })

  test('PatchFlags: PatchFlags.FULL_PROPS', async () => {
    let propName = 'foo'

    renderWithBlock(() => [
      createVNode('p', { [propName]: 'dynamic' }, '', PatchFlags.FULL_PROPS),
    ])

    expect(inner(root)).toBe('<div><p foo="dynamic"></p></div>')
    expect(block!.dynamicChildren!.length).toBe(1)
    expect(serialize(block!.dynamicChildren![0].el as TestElement)).toBe(
      '<p foo="dynamic"></p>',
    )

    propName = 'bar'
    renderWithBlock(() => [
      createVNode('p', { [propName]: 'dynamic' }, '', PatchFlags.FULL_PROPS),
    ])

    expect(inner(root)).toBe('<div><p bar="dynamic"></p></div>')
    expect(block!.dynamicChildren!.length).toBe(1)
    expect(serialize(block!.dynamicChildren![0].el as TestElement)).toBe(
      '<p bar="dynamic"></p>',
    )
  })

  // the order and length of the list will not change
  test('PatchFlags: PatchFlags.STABLE_FRAGMENT', async () => {
    let list = ['foo', 'bar']
    render(
      (openBlock(),
      (block = createBlock(
        Fragment,
        null,
        list.map(item => {
          return createVNode('p', null, item, PatchFlags.TEXT)
        }),
        PatchFlags.STABLE_FRAGMENT,
      ))),
      root,
    )

    expect(inner(root)).toBe('<p>foo</p><p>bar</p>')
    expect(block.dynamicChildren!.length).toBe(2)
    expect(serialize(block.dynamicChildren![0].el as TestElement)).toBe(
      '<p>foo</p>',
    )
    expect(serialize(block.dynamicChildren![1].el as TestElement)).toBe(
      '<p>bar</p>',
    )

    list = list.map(item => item.repeat(2))
    render(
      (openBlock(),
      createBlock(
        Fragment,
        null,
        list.map(item => {
          return createVNode('p', null, item, PatchFlags.TEXT)
        }),
        PatchFlags.STABLE_FRAGMENT,
      )),
      root,
    )

    expect(inner(root)).toBe('<p>foofoo</p><p>barbar</p>')
    expect(block.dynamicChildren!.length).toBe(2)
    expect(serialize(block.dynamicChildren![0].el as TestElement)).toBe(
      '<p>foofoo</p>',
    )
    expect(serialize(block.dynamicChildren![1].el as TestElement)).toBe(
      '<p>barbar</p>',
    )
  })

  // A Fragment with `UNKEYED_FRAGMENT` flag will always patch its children,
  // so there's no need for tracking dynamicChildren.
  test('PatchFlags: PatchFlags.UNKEYED_FRAGMENT', async () => {
    const list = [{ tag: 'p', text: 'foo' }]
    render(
      (openBlock(true),
      (block = createBlock(
        Fragment,
        null,
        list.map(item => {
          return createVNode(item.tag, null, item.text)
        }),
        PatchFlags.UNKEYED_FRAGMENT,
      ))),
      root,
    )

    expect(inner(root)).toBe('<p>foo</p>')
    expect(block.dynamicChildren!.length).toBe(0)

    list.unshift({ tag: 'i', text: 'bar' })
    render(
      (openBlock(true),
      createBlock(
        Fragment,
        null,
        list.map(item => {
          return createVNode(item.tag, null, item.text)
        }),
        PatchFlags.UNKEYED_FRAGMENT,
      )),
      root,
    )

    expect(inner(root)).toBe('<i>bar</i><p>foo</p>')
    expect(block.dynamicChildren!.length).toBe(0)
  })

  // A Fragment with `KEYED_FRAGMENT` will always patch its children,
  // so there's no need for tracking dynamicChildren.
  test('PatchFlags: PatchFlags.KEYED_FRAGMENT', async () => {
    const list = [{ tag: 'p', text: 'foo' }]
    render(
      (openBlock(true),
      (block = createBlock(
        Fragment,
        null,
        list.map(item => {
          return createVNode(item.tag, { key: item.tag }, item.text)
        }),
        PatchFlags.KEYED_FRAGMENT,
      ))),
      root,
    )

    expect(inner(root)).toBe('<p>foo</p>')
    expect(block.dynamicChildren!.length).toBe(0)

    list.unshift({ tag: 'i', text: 'bar' })
    render(
      (openBlock(true),
      createBlock(
        Fragment,
        null,
        list.map(item => {
          return createVNode(item.tag, { key: item.tag }, item.text)
        }),
        PatchFlags.KEYED_FRAGMENT,
      )),
      root,
    )

    expect(inner(root)).toBe('<i>bar</i><p>foo</p>')
    expect(block.dynamicChildren!.length).toBe(0)
  })

  test('PatchFlags: PatchFlags.NEED_PATCH', async () => {
    const spyMounted = vi.fn()
    const spyUpdated = vi.fn()
    const count = ref(0)
    const Comp = {
      setup() {
        return () => {
          count.value
          return (
            openBlock(),
            (block = createBlock('div', null, [
              createVNode(
                'p',
                { onVnodeMounted: spyMounted, onVnodeBeforeUpdate: spyUpdated },
                '',
                PatchFlags.NEED_PATCH,
              ),
            ]))
          )
        }
      },
    }

    render(h(Comp), root)

    expect(inner(root)).toBe('<div><p></p></div>')
    expect(block!.dynamicChildren!.length).toBe(1)
    expect(serialize(block!.dynamicChildren![0].el as TestElement)).toBe(
      '<p></p>',
    )
    expect(spyMounted).toHaveBeenCalledTimes(1)
    expect(spyUpdated).toHaveBeenCalledTimes(0)

    count.value++
    await nextTick()

    expect(inner(root)).toBe('<div><p></p></div>')
    expect(block!.dynamicChildren!.length).toBe(1)
    expect(serialize(block!.dynamicChildren![0].el as TestElement)).toBe(
      '<p></p>',
    )
    expect(spyMounted).toHaveBeenCalledTimes(1)
    expect(spyUpdated).toHaveBeenCalledTimes(1)
  })

  test('PatchFlags: PatchFlags.BAIL', async () => {
    render(
      (openBlock(),
      (block = createBlock('div', null, [createVNode('p', null, 'foo')]))),
      root,
    )

    expect(inner(root)).toBe('<div><p>foo</p></div>')
    expect(block!.dynamicChildren!.length).toBe(0)

    render(
      (openBlock(),
      (block = createBlock(
        'div',
        null,
        [createVNode('i', null, 'bar')],
        PatchFlags.BAIL,
      ))),
      root,
    )

    expect(inner(root)).toBe('<div><i>bar</i></div>')
    expect(block!.dynamicChildren).toBe(null)
  })

  // #1980
  test('dynamicChildren should be tracked correctly when normalizing slots to plain children', async () => {
    let block: VNode
    const Comp = defineComponent({
      setup(_props, { slots }) {
        return () => {
          const vnode =
            (openBlock(),
            (block = createBlock('div', null, {
              default: withCtx(() => [renderSlot(slots, 'default')]),
              _: SlotFlags.FORWARDED,
            })))

          return vnode
        }
      },
    })

    const foo = ref(0)
    const App = {
      setup() {
        return () => {
          return createBlock(Comp, null, {
            default: withCtx(() => [
              createVNode('p', null, foo.value, PatchFlags.TEXT),
            ]),
            // Indicates that this is a stable slot to avoid bail out
            _: SlotFlags.STABLE,
          })
        }
      },
    }

    render(h(App), root)
    expect(inner(root)).toBe('<div><p>0</p></div>')
    expect(block!.dynamicChildren!.length).toBe(1)
    expect(block!.dynamicChildren![0].type).toBe(Fragment)
    expect(block!.dynamicChildren![0].dynamicChildren!.length).toBe(1)
    expect(
      serialize(
        block!.dynamicChildren![0].dynamicChildren![0].el as TestElement,
      ),
    ).toBe('<p>0</p>')

    foo.value++
    await nextTick()

    expect(inner(root)).toBe('<div><p>1</p></div>')
  })

  // #2169
  // block
  // - dynamic child (1)
  //   - component (2)
  // When unmounting (1), we know we are in optimized mode so no need to further
  // traverse unmount its children
  test('should not perform unnecessary unmount traversals', () => {
    const spy = vi.fn()
    const Child = {
      setup() {
        onBeforeUnmount(spy)
        return () => 'child'
      },
    }
    const Parent = () => (
      openBlock(),
      createBlock('div', null, [
        createVNode('div', { style: {} }, [createVNode(Child)], 4 /* STYLE */),
      ])
    )
    render(h(Parent), root)
    render(null, root)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  test('should call onUnmounted hook for dynamic components receiving an existing vnode w/ component children', async () => {
    const spy = vi.fn()
    const show = ref(1)
    const Child = {
      setup() {
        onUnmounted(spy)
        return () => 'child'
      },
    }
    const foo = h('div', null, h(Child))
    const app = createApp({
      render() {
        return show.value
          ? (openBlock(),
            createBlock('div', null, [(openBlock(), createBlock(foo))]))
          : createCommentVNode('v-if', true)
      },
    })

    app.mount(root)
    show.value = 0
    await nextTick()

    expect(spy).toHaveBeenCalledTimes(1)
  })

  // #2444
  // `KEYED_FRAGMENT` and `UNKEYED_FRAGMENT` always need to diff its children
  test('non-stable Fragment always need to diff its children', () => {
    const spyA = vi.fn()
    const spyB = vi.fn()
    const ChildA = {
      setup() {
        onBeforeUnmount(spyA)
        return () => 'child'
      },
    }
    const ChildB = {
      setup() {
        onBeforeUnmount(spyB)
        return () => 'child'
      },
    }
    const Parent = () => (
      openBlock(),
      createBlock('div', null, [
        (openBlock(true),
        createBlock(
          Fragment,
          null,
          [createVNode(ChildA, { key: 0 })],
          128 /* KEYED_FRAGMENT */,
        )),
        (openBlock(true),
        createBlock(
          Fragment,
          null,
          [createVNode(ChildB)],
          256 /* UNKEYED_FRAGMENT */,
        )),
      ])
    )
    render(h(Parent), root)
    render(null, root)
    expect(spyA).toHaveBeenCalledTimes(1)
    expect(spyB).toHaveBeenCalledTimes(1)
  })

  // #2893
  test('manually rendering the optimized slots should allow subsequent updates to exit the optimized mode correctly', async () => {
    const state = ref(0)

    const CompA = {
      name: 'A',
      setup(props: any, { slots }: SetupContext) {
        return () => {
          return (
            openBlock(),
            createBlock('div', null, [renderSlot(slots, 'default')])
          )
        }
      },
    }

    const Wrapper = {
      name: 'Wrapper',
      setup(props: any, { slots }: SetupContext) {
        // use the manually written render function to rendering the optimized slots,
        // which should make subsequent updates exit the optimized mode correctly
        return () => {
          return slots.default!()[state.value]
        }
      },
    }

    const app = createApp({
      name: 'App',
      setup() {
        return () => {
          return (
            openBlock(),
            createBlock(Wrapper, null, {
              default: withCtx(() => [
                createVNode(CompA, null, {
                  default: withCtx(() => [createTextVNode('Hello')]),
                  _: 1 /* STABLE */,
                }),
                createVNode(CompA, null, {
                  default: withCtx(() => [createTextVNode('World')]),
                  _: 1 /* STABLE */,
                }),
              ]),
              _: 1 /* STABLE */,
            })
          )
        }
      },
    })

    app.mount(root)
    expect(inner(root)).toBe('<div>Hello</div>')

    state.value = 1
    await nextTick()
    expect(inner(root)).toBe('<div>World</div>')
  })

  //#3623
  test('nested teleport unmount need exit the optimization mode', async () => {
    const target = nodeOps.createElement('div')
    const root = nodeOps.createElement('div')

    render(
      (openBlock(),
      createBlock('div', null, [
        (openBlock(),
        createBlock(
          Teleport as any,
          {
            to: target,
          },
          [
            createVNode('div', null, [
              (openBlock(),
              createBlock(
                Teleport as any,
                {
                  to: target,
                },
                [createVNode('div', null, 'foo')],
              )),
            ]),
          ],
        )),
      ])),
      root,
    )
    await nextTick()
    expect(inner(target)).toMatchInlineSnapshot(
      `"<div><!--teleport start--><!--teleport end--></div><div>foo</div>"`,
    )
    expect(inner(root)).toMatchInlineSnapshot(
      `"<div><!--teleport start--><!--teleport end--></div>"`,
    )

    render(null, root)
    expect(inner(target)).toBe('')
  })

  // #3548
  test('should not track dynamic children when the user calls a compiled slot inside template expression', () => {
    const Comp = {
      setup(props: any, { slots }: SetupContext) {
        return () => {
          return (
            openBlock(),
            (block = createBlock('section', null, [
              renderSlot(slots, 'default'),
            ]))
          )
        }
      },
    }

    let dynamicVNode: VNode
    const Wrapper = {
      setup(props: any, { slots }: SetupContext) {
        return () => {
          return (
            openBlock(),
            createBlock(Comp, null, {
              default: withCtx(() => {
                return [
                  (dynamicVNode = createVNode(
                    'div',
                    {
                      class: {
                        foo: !!slots.default!(),
                      },
                    },
                    null,
                    PatchFlags.CLASS,
                  )),
                ]
              }),
              _: 1,
            })
          )
        }
      },
    }
    const app = createApp({
      render() {
        return (
          openBlock(),
          createBlock(Wrapper, null, {
            default: withCtx(() => {
              return [createVNode({}) /* component */]
            }),
            _: 1,
          })
        )
      },
    })

    app.mount(root)
    expect(inner(root)).toBe('<section><div class="foo"></div></section>')
    /**
     * Block Tree:
     *  - block(div)
     *   - block(Fragment): renderSlots()
     *    - dynamicVNode
     */
    expect(block!.dynamicChildren!.length).toBe(1)
    expect(block!.dynamicChildren![0].dynamicChildren!.length).toBe(1)
    expect(block!.dynamicChildren![0].dynamicChildren![0]).toEqual(
      dynamicVNode!,
    )
  })

  // 3569
  test('should force bailout when the user manually calls the slot function', async () => {
    const index = ref(0)
    const Foo = {
      setup(props: any, { slots }: SetupContext) {
        return () => {
          return slots.default!()[index.value]
        }
      },
    }

    const app = createApp({
      setup() {
        return () => {
          return (
            openBlock(),
            createBlock(Foo, null, {
              default: withCtx(() => [
                true
                  ? (openBlock(), createBlock('p', { key: 0 }, '1'))
                  : createCommentVNode('v-if', true),
                true
                  ? (openBlock(), createBlock('p', { key: 0 }, '2'))
                  : createCommentVNode('v-if', true),
              ]),
              _: 1 /* STABLE */,
            })
          )
        }
      },
    })

    app.mount(root)
    expect(inner(root)).toBe('<p>1</p>')

    index.value = 1
    await nextTick()
    expect(inner(root)).toBe('<p>2</p>')

    index.value = 0
    await nextTick()
    expect(inner(root)).toBe('<p>1</p>')
  })

  // #3779
  test('treat slots manually written by the user as dynamic', async () => {
    const Middle = {
      setup(props: any, { slots }: any) {
        return slots.default!
      },
    }

    const Comp = {
      setup(props: any, { slots }: any) {
        return () => {
          return (
            openBlock(),
            createBlock('div', null, [
              createVNode(Middle, null, {
                default: withCtx(
                  () => [
                    createVNode('div', null, [renderSlot(slots, 'default')]),
                  ],
                  undefined,
                ),
                _: 3 /* FORWARDED */,
              }),
            ])
          )
        }
      },
    }

    const loading = ref(false)
    const app = createApp({
      setup() {
        return () => {
          // important: write the slot content here
          const content = h('span', loading.value ? 'loading' : 'loaded')
          return h(Comp, null, {
            default: () => content,
          })
        }
      },
    })

    app.mount(root)
    expect(inner(root)).toBe('<div><div><span>loaded</span></div></div>')

    loading.value = true
    await nextTick()
    expect(inner(root)).toBe('<div><div><span>loading</span></div></div>')
  })

  // #3828
  test('patch Suspense in optimized mode w/ nested dynamic nodes', async () => {
    const show = ref(false)

    const app = createApp({
      render() {
        return (
          openBlock(),
          createBlock(
            Fragment,
            null,
            [
              (openBlock(),
              createBlock(SuspenseImpl, null, {
                default: withCtx(() => [
                  createVNode('div', null, [
                    createVNode('div', null, show.value, PatchFlags.TEXT),
                  ]),
                ]),
                _: SlotFlags.STABLE,
              })),
            ],
            PatchFlags.STABLE_FRAGMENT,
          )
        )
      },
    })

    app.mount(root)
    expect(inner(root)).toBe('<div><div>false</div></div>')

    show.value = true
    await nextTick()
    expect(inner(root)).toBe('<div><div>true</div></div>')
  })

  // #4183
  test('should not take unmount children fast path /w Suspense', async () => {
    const show = ref(true)
    const spyUnmounted = vi.fn()

    const Parent = {
      setup(props: any, { slots }: SetupContext) {
        return () => (
          openBlock(),
          createBlock(SuspenseImpl, null, {
            default: withCtx(() => [renderSlot(slots, 'default')]),
            _: SlotFlags.FORWARDED,
          })
        )
      },
    }

    const Child = {
      setup() {
        onUnmounted(spyUnmounted)
        return () => createVNode('div', null, show.value, PatchFlags.TEXT)
      },
    }

    const app = createApp({
      render() {
        return show.value
          ? (openBlock(),
            createBlock(
              Parent,
              { key: 0 },
              {
                default: withCtx(() => [createVNode(Child)]),
                _: SlotFlags.STABLE,
              },
            ))
          : createCommentVNode('v-if', true)
      },
    })

    app.mount(root)
    expect(inner(root)).toBe('<div>true</div>')

    show.value = false
    await nextTick()
    expect(inner(root)).toBe('<!--v-if-->')
    expect(spyUnmounted).toHaveBeenCalledTimes(1)
  })

  // #3881
  // root cause: fragment inside a compiled slot passed to component which
  // programmatically invokes the slot. The entire slot should de-opt but
  // the fragment was incorrectly put in optimized mode which causes it to skip
  // updates for its inner components.
  test('fragments inside programmatically invoked compiled slot should de-opt properly', async () => {
    const Parent: FunctionalComponent = (_, { slots }) => slots.default!()
    const Dummy = () => 'dummy'

    const toggle = ref(true)
    const force = ref(0)

    const app = createApp({
      render() {
        if (!toggle.value) {
          return null
        }
        return h(
          Parent,
          { n: force.value },
          {
            default: withCtx(
              () => [
                createVNode('ul', null, [
                  (openBlock(),
                  createBlock(
                    Fragment,
                    null,
                    renderList(1, item => {
                      return createVNode('li', null, [createVNode(Dummy)])
                    }),
                    64 /* STABLE_FRAGMENT */,
                  )),
                ]),
              ],
              undefined,
              true,
            ),
            _: 1 /* STABLE */,
          },
        )
      },
    })

    app.mount(root)

    // force a patch
    force.value++
    await nextTick()
    expect(inner(root)).toBe(`<ul><li>dummy</li></ul>`)

    // unmount
    toggle.value = false
    await nextTick()
    // should successfully unmount without error
    expect(inner(root)).toBe(`<!---->`)
  })

  // #10870
  test('should bail manually rendered compiler slots for both mount and update', async () => {
    // only reproducible in prod
    __DEV__ = false
    function Outer(_: any, { slots }: any) {
      return slots.default()
    }
    const Mid = {
      render(ctx: any) {
        return (
          openBlock(),
          createElementBlock('div', null, [renderSlot(ctx.$slots, 'default')])
        )
      },
    }
    const state1 = ref(true)
    const state2 = ref(true)
    const App = {
      render() {
        return (
          openBlock(),
          createBlock(Outer, null, {
            default: withCtx(() => [
              createVNode(
                Mid,
                { foo: state2.value },
                {
                  default: withCtx(() => [
                    createElementVNode('div', null, [
                      createElementVNode('div', null, [
                        state2.value
                          ? (openBlock(),
                            createElementBlock(
                              'div',
                              {
                                key: 0,
                                id: 'if',
                                foo: state1.value,
                              },
                              null,
                              8 /* PROPS */,
                              ['foo'],
                            ))
                          : createCommentVNode('v-if', true),
                      ]),
                    ]),
                  ]),
                  _: 1 /* STABLE */,
                },
                8 /* PROPS */,
                ['foo'],
              ),
            ]),
            _: 1 /* STABLE */,
          })
        )
      },
    }

    const app = createApp(App)
    app.config.errorHandler = vi.fn()

    try {
      app.mount(root)

      state1.value = false
      await nextTick()

      state2.value = false
      await nextTick()
    } finally {
      __DEV__ = true
      expect(app.config.errorHandler).not.toHaveBeenCalled()
    }
  })

  // #11336
  test('should bail manually rendered compiler slots for both mount and update (2)', async () => {
    // only reproducible in prod
    __DEV__ = false
    const n = ref(0)
    function Outer(_: any, { slots }: any) {
      n.value // track
      return slots.default()
    }
    const Mid = {
      render(ctx: any) {
        return (
          openBlock(),
          createElementBlock('div', null, [renderSlot(ctx.$slots, 'default')])
        )
      },
    }
    const show = ref(false)
    const App = {
      render() {
        return (
          openBlock(),
          createBlock(Outer, null, {
            default: withCtx(() => [
              createVNode(Mid, null, {
                default: withCtx(() => [
                  createElementVNode('div', null, [
                    show.value
                      ? (openBlock(),
                        createElementBlock('div', { key: 0 }, '1'))
                      : createCommentVNode('v-if', true),
                    createElementVNode('div', null, '2'),
                    createElementVNode('div', null, '3'),
                  ]),
                  createElementVNode('div', null, '4'),
                ]),
                _: 1 /* STABLE */,
              }),
            ]),
            _: 1 /* STABLE */,
          })
        )
      },
    }

    const app = createApp(App)
    app.config.errorHandler = vi.fn()

    try {
      app.mount(root)

      // force Outer update, which will assign new slots to Mid
      // we want to make sure the compiled slot flag doesn't accidentally
      // get assigned again
      n.value++
      await nextTick()

      show.value = true
      await nextTick()
    } finally {
      __DEV__ = true
      expect(app.config.errorHandler).not.toHaveBeenCalled()
    }
  })

  test('diff slot and slot fallback node', async () => {
    const Comp = {
      props: ['show'],
      setup(props: any, { slots }: SetupContext) {
        return () => {
          return (
            openBlock(),
            createElementBlock('div', null, [
              renderSlot(slots, 'default', { hide: !props.show }, () => [
                (openBlock(),
                (block = createElementBlock(
                  Fragment,
                  { key: 0 },
                  [createTextVNode('foo')],
                  PatchFlags.STABLE_FRAGMENT,
                ))),
              ]),
            ])
          )
        }
      },
    }

    const show = ref(true)
    const app = createApp({
      render() {
        return (
          openBlock(),
          createBlock(
            Comp,
            { show: show.value },
            {
              default: withCtx(({ hide }: { hide: boolean }) => [
                !hide
                  ? (openBlock(),
                    createElementBlock(
                      Fragment,
                      { key: 0 },
                      [
                        createCommentVNode('comment'),
                        createElementVNode(
                          'div',
                          null,
                          'bar',
                          PatchFlags.CACHED,
                        ),
                      ],
                      PatchFlags.STABLE_FRAGMENT,
                    ))
                  : createCommentVNode('v-if', true),
              ]),
              _: SlotFlags.STABLE,
            },
            PatchFlags.PROPS,
            ['show'],
          )
        )
      },
    })

    app.mount(root)
    expect(inner(root)).toBe('<div><!--comment--><div>bar</div></div>')
    expect(block).toBe(null)

    show.value = false
    await nextTick()
    expect(inner(root)).toBe('<div>foo</div>')

    show.value = true
    await nextTick()
    expect(inner(root)).toBe('<div><!--comment--><div>bar</div></div>')
  })

  test('should not take unmount children fast path if children contain cached nodes', async () => {
    const show = ref(true)
    const spyUnmounted = vi.fn()

    const Child = {
      setup() {
        onUnmounted(spyUnmounted)
        return () => createVNode('div', null, 'Child')
      },
    }

    const app = createApp({
      render(_: any, cache: any) {
        return show.value
          ? (openBlock(),
            createBlock('div', null, [
              createVNode('div', null, [
                cache[0] ||
                  (setBlockTracking(-1, true),
                  ((cache[0] = createVNode('div', null, [
                    createVNode(Child),
                  ])).cacheIndex = 0),
                  setBlockTracking(1),
                  cache[0]),
              ]),
            ]))
          : createCommentVNode('v-if', true)
      },
    })

    app.mount(root)
    expect(inner(root)).toBe(
      '<div><div><div><div>Child</div></div></div></div>',
    )

    show.value = false
    await nextTick()
    expect(inner(root)).toBe('<!--v-if-->')
    expect(spyUnmounted).toHaveBeenCalledTimes(1)

    show.value = true
    await nextTick()
    expect(inner(root)).toBe(
      '<div><div><div><div>Child</div></div></div></div>',
    )

    // should unmount again, this verifies previous cache was properly cleared
    show.value = false
    await nextTick()
    expect(inner(root)).toBe('<!--v-if-->')
    expect(spyUnmounted).toHaveBeenCalledTimes(2)
  })

  // #12371
  test('unmount children when the user calls a compiled slot', async () => {
    const beforeMountSpy = vi.fn()
    const beforeUnmountSpy = vi.fn()

    const Child = {
      setup() {
        onBeforeMount(beforeMountSpy)
        onBeforeUnmount(beforeUnmountSpy)
        return () => 'child'
      },
    }

    const Wrapper = {
      setup(_: any, { slots }: SetupContext) {
        return () => (
          openBlock(),
          createElementBlock('section', null, [
            (openBlock(),
            createElementBlock('div', { key: 1 }, [
              createTextVNode(slots.header!() ? 'foo' : 'bar', 1 /* TEXT */),
              renderSlot(slots, 'content'),
            ])),
          ])
        )
      },
    }

    const show = ref(false)
    const app = createApp({
      render() {
        return show.value
          ? (openBlock(),
            createBlock(Wrapper, null, {
              header: withCtx(() => [createVNode({})]),
              content: withCtx(() => [createVNode(Child)]),
              _: 1,
            }))
          : createCommentVNode('v-if', true)
      },
    })

    app.mount(root)
    expect(inner(root)).toMatchInlineSnapshot(`"<!--v-if-->"`)
    expect(beforeMountSpy).toHaveBeenCalledTimes(0)
    expect(beforeUnmountSpy).toHaveBeenCalledTimes(0)

    show.value = true
    await nextTick()
    expect(inner(root)).toMatchInlineSnapshot(
      `"<section><div>foochild</div></section>"`,
    )
    expect(beforeMountSpy).toHaveBeenCalledTimes(1)

    show.value = false
    await nextTick()
    expect(inner(root)).toBe('<!--v-if-->')
    expect(beforeUnmountSpy).toHaveBeenCalledTimes(1)
  })
})
