// NOTE: This test is implemented based on the case of `runtime-core/__test__/componentSlots.spec.ts`.

import {
  createComponent,
  createForSlots,
  createIf,
  createSlot,
  createVaporApp,
  defineVaporComponent,
  forwardedSlotCreator,
  insert,
  prepend,
  renderEffect,
  template,
  vaporInteropPlugin,
} from '../src'
import {
  createApp,
  createSlots,
  currentInstance,
  h,
  nextTick,
  ref,
  renderSlot,
} from '@vue/runtime-dom'
import { makeRender } from './_utils'
import type { DynamicSlot } from '../src/componentSlots'
import { setElementText, setText } from '../src/dom/prop'

const define = makeRender<any>()

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

  test('should work with createFlorSlots', async () => {
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
          createSlot('header', { title: () => src.value }),
          n0 as any as ParentNode,
        )
        return n0
      })

      const { host } = define(() => {
        return createComponent(Comp, null, {
          header: props => {
            const el = template('<h1></h1>')()
            renderEffect(() => {
              setElementText(el, props.title)
            })
            return el
          },
        })
      }).render()

      expect(host.innerHTML).toBe('<div><h1>header</h1><!--slot--></div>')

      src.value = 'footer'
      await nextTick()
      expect(host.innerHTML).toBe('<div><h1>footer</h1><!--slot--></div>')
    })

    test('dynamic slot props', async () => {
      let props: any

      const bindObj = ref<Record<string, any>>({ foo: 1, baz: 'qux' })
      const Comp = defineVaporComponent(() =>
        createSlot('default', { $: [() => bindObj.value] }),
      )
      define(() =>
        createComponent(Comp, null, {
          default: _props => ((props = _props), []),
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
          default: _props => ((props = _props), []),
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
                ? { name: 'one', fn: () => template('one content')() }
                : { name: 'two', fn: () => template('two content')() },
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
            default: () => {
              return createIf(
                () => toggle.value,
                () => {
                  return document.createTextNode('content')
                },
              )
            },
          })
        },
      }).render()

      expect(html()).toBe('content<!--if--><!--slot-->')

      toggle.value = false
      await nextTick()
      expect(html()).toBe('fallback<!--if--><!--slot-->')

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
            default: () => {
              return createIf(
                () => toggle.value,
                () => {
                  return document.createTextNode('content')
                },
              )
            },
          })
        },
      }).render()

      expect(html()).toBe('fallback<!--if--><!--slot-->')

      toggle.value = true
      await nextTick()
      expect(html()).toBe('content<!--if--><!--slot-->')

      toggle.value = false
      await nextTick()
      expect(html()).toBe('fallback<!--if--><!--slot-->')
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
          const createForwardedSlot = forwardedSlotCreator()
          const n2 = createComponent(
            Child,
            null,
            {
              foo: () => {
                return createForwardedSlot('foo', null)
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
          const createForwardedSlot = forwardedSlotCreator()
          const n2 = createComponent(Child, null, {
            foo: () => {
              const n0 = createForwardedSlot('foo', null)
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

    describe('vdom interop', () => {
      test('vdom slot > vapor forwarded slot > vapor slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VaporSlot = defineVaporComponent({
          setup() {
            const n0 = createSlot('foo', null, () => {
              const n2 = template('<div>fallback</div>')()
              return n2
            })
            return n0
          },
        })

        const VaporForwardedSlot = defineVaporComponent({
          setup() {
            const createForwardedSlot = forwardedSlotCreator()
            const n2 = createComponent(
              VaporSlot,
              null,
              {
                foo: () => {
                  return createForwardedSlot('foo', null)
                },
              },
              true,
            )
            return n2
          },
        })

        const App = {
          setup() {
            return () =>
              h(
                VaporForwardedSlot as any,
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

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span><!--slot-->')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot-->')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<!--slot--><div>fallback</div>')
      })

      test('vdom slot > vapor forwarded slot(with fallback) > vapor slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VaporSlot = defineVaporComponent({
          setup() {
            const n0 = createSlot('foo', null, () => {
              const n2 = template('<div>fallback</div>')()
              return n2
            })
            return n0
          },
        })

        const VaporForwardedSlotWithFallback = defineVaporComponent({
          setup() {
            const createForwardedSlot = forwardedSlotCreator()
            const n2 = createComponent(
              VaporSlot,
              null,
              {
                foo: () => {
                  return createForwardedSlot('foo', null, () => {
                    const n2 = template('<div>forwarded fallback</div>')()
                    return n2
                  })
                },
              },
              true,
            )
            return n2
          },
        })

        const App = {
          setup() {
            return () =>
              h(
                VaporForwardedSlotWithFallback as any,
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

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span><!--slot-->')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot-->')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<!--slot--><div>forwarded fallback</div>')
      })

      test('vdom slot > vapor forwarded slot > vdom slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VdomSlot = {
          render(this: any) {
            return renderSlot(this.$slots, 'foo', {}, () => [
              h('div', 'fallback'),
            ])
          },
        }

        const VaporForwardedSlot = defineVaporComponent({
          setup() {
            const createForwardedSlot = forwardedSlotCreator()
            const n2 = createComponent(
              VdomSlot as any,
              null,
              {
                foo: () => {
                  return createForwardedSlot('foo', null)
                },
              },
              true,
            )
            return n2
          },
        })

        const App = {
          setup() {
            return () =>
              h(
                VaporForwardedSlot as any,
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

        const VdomSlot = {
          render(this: any) {
            return renderSlot(this.$slots, 'foo', {}, () => [
              h('div', 'fallback'),
            ])
          },
        }

        const VaporForwardedSlotWithFallback = defineVaporComponent({
          setup() {
            const createForwardedSlot = forwardedSlotCreator()
            const n2 = createComponent(
              VdomSlot as any,
              null,
              {
                foo: () => {
                  return createForwardedSlot('foo', null, () => {
                    const n2 = template('<div>forwarded fallback</div>')()
                    return n2
                  })
                },
              },
              true,
            )
            return n2
          },
        })

        const App = {
          setup() {
            return () =>
              h(
                VaporForwardedSlotWithFallback as any,
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

        const VaporSlot = defineVaporComponent({
          setup() {
            const n0 = createSlot('foo', null, () => {
              const n2 = template('<div>fallback</div>')()
              return n2
            })
            return n0
          },
        })

        const VdomForwardedSlot = {
          render(this: any) {
            return h(VaporSlot as any, null, {
              foo: () => [renderSlot(this.$slots, 'foo')],
              _: 3 /* FORWARDED */,
            })
          },
        }

        const VaporForwardedSlot = defineVaporComponent({
          setup() {
            const createForwardedSlot = forwardedSlotCreator()
            const n2 = createComponent(
              VdomForwardedSlot as any,
              null,
              {
                foo: () => {
                  return createForwardedSlot('foo', null)
                },
              },
              true,
            )
            return n2
          },
        })

        const App = {
          setup() {
            return () =>
              h(
                VaporForwardedSlot as any,
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

        const VaporSlot = defineVaporComponent({
          setup() {
            const n0 = createSlot('foo', null, () => {
              const n2 = template('<div>fallback</div>')()
              return n2
            })
            return n0
          },
        })

        const VdomForwardedSlot = {
          render(this: any) {
            return h(VaporSlot as any, null, {
              foo: () => [renderSlot(this.$slots, 'foo')],
              _: 3 /* FORWARDED */,
            })
          },
        }

        const VaporForwardedSlotWithFallback = defineVaporComponent({
          setup() {
            const createForwardedSlot = forwardedSlotCreator()
            const n2 = createComponent(
              VdomForwardedSlot as any,
              null,
              {
                foo: () => {
                  return createForwardedSlot('foo', null, () => {
                    const n2 = template('<div>forwarded fallback</div>')()
                    return n2
                  })
                },
              },
              true,
            )
            return n2
          },
        })

        const App = {
          setup() {
            return () =>
              h(
                VaporForwardedSlotWithFallback as any,
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

        const VaporSlot = defineVaporComponent({
          setup() {
            const n0 = createSlot('foo', null, () => {
              const n2 = template('<div>fallback</div>')()
              return n2
            })
            return n0
          },
        })

        const VdomForwardedSlotWithFallback = {
          render(this: any) {
            return h(VaporSlot as any, null, {
              foo: () => [
                renderSlot(this.$slots, 'foo', {}, () => {
                  return [h('div', 'vdom fallback')]
                }),
              ],
              _: 3 /* FORWARDED */,
            })
          },
        }

        const VaporForwardedSlot = defineVaporComponent({
          setup() {
            const createForwardedSlot = forwardedSlotCreator()
            const n2 = createComponent(
              VdomForwardedSlotWithFallback as any,
              null,
              {
                foo: () => {
                  return createForwardedSlot('foo', null)
                },
              },
              true,
            )
            return n2
          },
        })

        const App = {
          setup() {
            return () =>
              h(
                VaporForwardedSlot as any,
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
        const VaporSlot = defineVaporComponent({
          setup() {
            const n0 = createSlot('foo', null, () => {
              const n2 = template('<div>fallback</div>')()
              return n2
            })
            return n0
          },
        })

        const VdomForwardedSlotWithFallback = {
          render(this: any) {
            return h(VaporSlot as any, null, {
              foo: () => [
                renderSlot(this.$slots, 'foo', {}, () => {
                  return [h('div', 'vdom fallback')]
                }),
              ],
              _: 3 /* FORWARDED */,
            })
          },
        }

        const VaporForwardedSlot = defineVaporComponent({
          setup() {
            const createForwardedSlot = forwardedSlotCreator()
            const n2 = createComponent(
              VdomForwardedSlotWithFallback as any,
              null,
              {
                foo: () => {
                  return createForwardedSlot('foo', null)
                },
              },
              true,
            )
            return n2
          },
        })

        const App = {
          setup() {
            return () => h(VaporForwardedSlot as any)
          },
        }

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<div>vdom fallback</div>')
      })

      test('vdom slot > vapor forwarded slot > vdom forwarded slot > vdom slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VdomSlot = {
          render(this: any) {
            return renderSlot(this.$slots, 'foo', {}, () => [
              h('div', 'fallback'),
            ])
          },
        }

        const VdomForwardedSlot = {
          render(this: any) {
            return h(VdomSlot, null, {
              foo: () => [renderSlot(this.$slots, 'foo')],
              _: 3 /* FORWARDED */,
            })
          },
        }

        const VaporForwardedSlot = defineVaporComponent({
          setup() {
            const createForwardedSlot = forwardedSlotCreator()
            const n2 = createComponent(
              VdomForwardedSlot as any,
              null,
              {
                foo: () => {
                  return createForwardedSlot('foo', null)
                },
              },
              true,
            )
            return n2
          },
        })

        const App = {
          setup() {
            return () =>
              h(
                VaporForwardedSlot as any,
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

        const VdomSlot = {
          render(this: any) {
            return renderSlot(this.$slots, 'foo', {}, () => [
              h('div', 'fallback'),
            ])
          },
        }

        const VdomForwardedSlot = {
          render(this: any) {
            return h(VdomSlot, null, {
              foo: () => [renderSlot(this.$slots, 'foo')],
              _: 3 /* FORWARDED */,
            })
          },
        }

        const VaporForwardedSlotWithFallback = defineVaporComponent({
          setup() {
            const createForwardedSlot = forwardedSlotCreator()
            const n2 = createComponent(
              VdomForwardedSlot as any,
              null,
              {
                foo: () => {
                  return createForwardedSlot('foo', null, () => {
                    const n2 = template('<div>vapor fallback</div>')()
                    return n2
                  })
                },
              },
              true,
            )
            return n2
          },
        })

        const App = {
          setup() {
            return () =>
              h(
                VaporForwardedSlotWithFallback as any,
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

        const VdomSlot = {
          render(this: any) {
            return renderSlot(this.$slots, 'foo', {}, () => [
              h('div', 'fallback'),
            ])
          },
        }

        const VdomForwardedSlotWithFallback = {
          render(this: any) {
            return h(VdomSlot, null, {
              foo: () => [
                renderSlot(this.$slots, 'foo', {}, () => [
                  h('div', 'vdom fallback'),
                ]),
              ],
              _: 3 /* FORWARDED */,
            })
          },
        }

        const VaporForwardedSlot = defineVaporComponent({
          setup() {
            const createForwardedSlot = forwardedSlotCreator()
            const n2 = createComponent(
              VdomForwardedSlotWithFallback as any,
              null,
              {
                foo: () => {
                  return createForwardedSlot('foo', null)
                },
              },
              true,
            )
            return n2
          },
        })

        const App = {
          setup() {
            return () =>
              h(
                VaporForwardedSlot as any,
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

        const VdomSlot = {
          render(this: any) {
            return renderSlot(this.$slots, 'foo', {}, () => [
              h('div', 'fallback'),
            ])
          },
        }

        const VdomForwardedSlot = {
          render(this: any) {
            return h(VdomSlot, null, {
              foo: () => [renderSlot(this.$slots, 'foo')],
              _: 3 /* FORWARDED */,
            })
          },
        }

        const VaporForwardedSlot2 = defineVaporComponent({
          setup() {
            const createForwardedSlot = forwardedSlotCreator()
            const n2 = createComponent(
              VdomForwardedSlot as any,
              null,
              {
                foo: () => {
                  return createForwardedSlot('foo', null)
                },
              },
              true,
            )
            return n2
          },
        })

        const VaporForwardedSlot1 = defineVaporComponent({
          setup() {
            const createForwardedSlot = forwardedSlotCreator()
            const n2 = createComponent(
              VaporForwardedSlot2,
              null,
              {
                foo: () => {
                  return createForwardedSlot('foo', null)
                },
              },
              true,
            )
            return n2
          },
        })

        const VaporForwardedSlot = defineVaporComponent({
          setup() {
            const createForwardedSlot = forwardedSlotCreator()
            const n2 = createComponent(
              VaporForwardedSlot1,
              null,
              {
                foo: () => {
                  return createForwardedSlot('foo', null)
                },
              },
              true,
            )
            return n2
          },
        })

        const App = {
          setup() {
            return () =>
              h(
                VaporForwardedSlot as any,
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

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span><!--slot--><!--slot-->')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot--><!--slot-->')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<!--slot--><!--slot--><div>fallback</div>')

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<!--slot--><!--slot--><span>bar</span>')
      })

      test('vdom slot > vapor forwarded slot (multiple) > vdom forwarded slot(with fallback) > vdom slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VdomSlot = {
          render(this: any) {
            return renderSlot(this.$slots, 'foo', {}, () => [
              h('div', 'fallback'),
            ])
          },
        }

        const VdomForwardedSlotWithFallback = {
          render(this: any) {
            return h(VdomSlot, null, {
              foo: () => [
                renderSlot(this.$slots, 'foo', {}, () => [
                  h('div', 'vdom fallback'),
                ]),
              ],
              _: 3 /* FORWARDED */,
            })
          },
        }

        const VaporForwardedSlot2 = defineVaporComponent({
          setup() {
            const createForwardedSlot = forwardedSlotCreator()
            const n2 = createComponent(
              VdomForwardedSlotWithFallback as any,
              null,
              {
                foo: () => {
                  return createForwardedSlot('foo', null)
                },
              },
              true,
            )
            return n2
          },
        })

        const VaporForwardedSlot1 = defineVaporComponent({
          setup() {
            const createForwardedSlot = forwardedSlotCreator()
            const n2 = createComponent(
              VaporForwardedSlot2,
              null,
              {
                foo: () => {
                  return createForwardedSlot('foo', null)
                },
              },
              true,
            )
            return n2
          },
        })

        const VaporForwardedSlot = defineVaporComponent({
          setup() {
            const createForwardedSlot = forwardedSlotCreator()
            const n2 = createComponent(
              VaporForwardedSlot1,
              null,
              {
                foo: () => {
                  return createForwardedSlot('foo', null)
                },
              },
              true,
            )
            return n2
          },
        })

        const App = {
          setup() {
            return () =>
              h(
                VaporForwardedSlot as any,
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

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span><!--slot--><!--slot-->')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot--><!--slot-->')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe(
          '<!--slot--><!--slot--><div>vdom fallback</div>',
        )

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<!--slot--><!--slot--><span>bar</span>')
      })

      test('vdom slot > vdom forwarded slot > vapor slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VaporSlot = defineVaporComponent({
          setup() {
            const n0 = createSlot('foo', null, () => {
              const n2 = template('<div>fallback</div>')()
              return n2
            })
            return n0
          },
        })

        const VdomForwardedSlot = {
          render(this: any) {
            return h(VaporSlot as any, null, {
              foo: () => [renderSlot(this.$slots, 'foo')],
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
                        fn: () => [h('span', foo.value)],
                        key: '0',
                      }
                    : undefined,
                ]),
              )
          },
        }

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

        const VaporSlot = defineVaporComponent({
          setup() {
            const n0 = createSlot('foo', null, () => {
              const n2 = template('<div>fallback</div>')()
              return n2
            })
            return n0
          },
        })

        const VaporForwardedSlot = defineVaporComponent({
          setup() {
            const createForwardedSlot = forwardedSlotCreator()
            const n2 = createComponent(
              VaporSlot as any,
              null,
              {
                foo: () => {
                  return createForwardedSlot('foo', null)
                },
              },
              true,
            )
            return n2
          },
        })

        const VdomForwardedSlot = {
          render(this: any) {
            return h(VaporForwardedSlot as any, null, {
              foo: () => [renderSlot(this.$slots, 'foo')],
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
                        fn: () => [h('span', foo.value)],
                        key: '0',
                      }
                    : undefined,
                ]),
              )
          },
        }

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span><!--slot-->')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot-->')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<!--slot--><div>fallback</div>')

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<!--slot--><span>bar</span>')
      })

      test('vdom slot > vdom forwarded slot (multiple) > vapor forwarded slot > vdom slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VaporSlot = defineVaporComponent({
          setup() {
            const n0 = createSlot('foo', null, () => {
              const n2 = template('<div>fallback</div>')()
              return n2
            })
            return n0
          },
        })

        const VaporForwardedSlot = defineVaporComponent({
          setup() {
            const createForwardedSlot = forwardedSlotCreator()
            const n2 = createComponent(
              VaporSlot as any,
              null,
              {
                foo: () => {
                  return createForwardedSlot('foo', null)
                },
              },
              true,
            )
            return n2
          },
        })

        const VdomForwardedSlot2 = {
          render(this: any) {
            return h(VaporForwardedSlot as any, null, {
              foo: () => [renderSlot(this.$slots, 'foo')],
              _: 3 /* FORWARDED */,
            })
          },
        }

        const VdomForwardedSlot1 = {
          render(this: any) {
            return h(VdomForwardedSlot2, null, {
              foo: () => [renderSlot(this.$slots, 'foo')],
              _: 3 /* FORWARDED */,
            })
          },
        }

        const VdomForwardedSlot = {
          render(this: any) {
            return h(VdomForwardedSlot1, null, {
              foo: () => [renderSlot(this.$slots, 'foo')],
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
                        fn: () => [h('span', foo.value)],
                        key: '0',
                      }
                    : undefined,
                ]),
              )
          },
        }

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span><!--slot-->')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot-->')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<!--slot--><div>fallback</div>')

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<!--slot--><span>bar</span>')
      })

      test('vdom slot > vdom forwarded slot (multiple) > vapor forwarded slot(with fallback) > vdom slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VaporSlot = defineVaporComponent({
          setup() {
            const n0 = createSlot('foo', null, () => {
              const n2 = template('<div>fallback</div>')()
              return n2
            })
            return n0
          },
        })

        const VaporForwardedSlot = defineVaporComponent({
          setup() {
            const createForwardedSlot = forwardedSlotCreator()
            const n2 = createComponent(
              VaporSlot as any,
              null,
              {
                foo: () => {
                  return createForwardedSlot('foo', null, () => {
                    const n2 = template('<div>vapor fallback</div>')()
                    return n2
                  })
                },
              },
              true,
            )
            return n2
          },
        })

        const VdomForwardedSlot2 = {
          render(this: any) {
            return h(VaporForwardedSlot as any, null, {
              foo: () => [renderSlot(this.$slots, 'foo')],
              _: 3 /* FORWARDED */,
            })
          },
        }

        const VdomForwardedSlot1 = {
          render(this: any) {
            return h(VdomForwardedSlot2, null, {
              foo: () => [renderSlot(this.$slots, 'foo')],
              _: 3 /* FORWARDED */,
            })
          },
        }

        const VdomForwardedSlot = {
          render(this: any) {
            return h(VdomForwardedSlot1, null, {
              foo: () => [renderSlot(this.$slots, 'foo')],
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
                        fn: () => [h('span', foo.value)],
                        key: '0',
                      }
                    : undefined,
                ]),
              )
          },
        }

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span><!--slot-->')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot-->')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<!--slot--><div>vapor fallback</div>')

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<!--slot--><span>bar</span>')
      })

      test('vdom slot > vapor forwarded slot > vapor forwarded slot > vdom slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VdomSlot = {
          render(this: any) {
            return renderSlot(this.$slots, 'foo', {}, () => [
              h('div', 'fallback'),
            ])
          },
        }

        const VaporForwardedSlot2 = defineVaporComponent({
          setup() {
            const createForwardedSlot = forwardedSlotCreator()
            const n2 = createComponent(
              VdomSlot as any,
              null,
              {
                foo: () => {
                  return createForwardedSlot('foo', null)
                },
              },
              true,
            )
            return n2
          },
        })

        const VaporForwardedSlot1 = defineVaporComponent({
          setup() {
            const createForwardedSlot = forwardedSlotCreator()
            const n2 = createComponent(
              VaporForwardedSlot2,
              null,
              {
                foo: () => {
                  return createForwardedSlot('foo', null)
                },
              },
              true,
            )
            return n2
          },
        })

        const App = {
          setup() {
            return () =>
              h(
                VaporForwardedSlot1 as any,
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

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span><!--slot-->')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot-->')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<!--slot--><div>fallback</div>')

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<!--slot--><span>bar</span>')
      })

      test('vdom slot > vapor forwarded slot(with fallback) > vapor forwarded slot > vdom slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VdomSlot = {
          render(this: any) {
            return renderSlot(this.$slots, 'foo', {}, () => [
              h('div', 'fallback'),
            ])
          },
        }

        const VaporForwardedSlot2 = defineVaporComponent({
          setup() {
            const createForwardedSlot = forwardedSlotCreator()
            const n2 = createComponent(
              VdomSlot as any,
              null,
              {
                foo: () => {
                  return createForwardedSlot('foo', null)
                },
              },
              true,
            )
            return n2
          },
        })

        const VaporForwardedSlot1WithFallback = defineVaporComponent({
          setup() {
            const createForwardedSlot = forwardedSlotCreator()
            const n2 = createComponent(
              VaporForwardedSlot2,
              null,
              {
                foo: () => {
                  return createForwardedSlot('foo', null, () => {
                    const n2 = template('<div>vapor1 fallback</div>')()
                    return n2
                  })
                },
              },
              true,
            )
            return n2
          },
        })

        const App = {
          setup() {
            return () =>
              h(
                VaporForwardedSlot1WithFallback as any,
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

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span><!--slot-->')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot-->')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<!--slot--><div>vapor1 fallback</div>')

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<!--slot--><span>bar</span>')
      })

      test('vdom slot > vapor forwarded slot > vapor forwarded slot(with fallback) > vdom slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VdomSlot = {
          render(this: any) {
            return renderSlot(this.$slots, 'foo', {}, () => [
              h('div', 'fallback'),
            ])
          },
        }

        const VaporForwardedSlot2WithFallback = defineVaporComponent({
          setup() {
            const createForwardedSlot = forwardedSlotCreator()
            const n2 = createComponent(
              VdomSlot as any,
              null,
              {
                foo: () => {
                  return createForwardedSlot('foo', null, () => {
                    const n2 = template('<div>vapor2 fallback</div>')()
                    return n2
                  })
                },
              },
              true,
            )
            return n2
          },
        })

        const VaporForwardedSlot1 = defineVaporComponent({
          setup() {
            const createForwardedSlot = forwardedSlotCreator()
            const n2 = createComponent(
              VaporForwardedSlot2WithFallback,
              null,
              {
                foo: () => {
                  return createForwardedSlot('foo', null)
                },
              },
              true,
            )
            return n2
          },
        })

        const App = {
          setup() {
            return () =>
              h(
                VaporForwardedSlot1 as any,
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

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span><!--slot-->')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot-->')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<!--slot--><div>vapor2 fallback</div>')

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<!--slot--><span>bar</span>')
      })

      test('vdom slot > vapor forwarded slot > vapor forwarded slot > vapor slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VaporSlot = defineVaporComponent({
          setup() {
            const n0 = createSlot('foo', null, () => {
              const n2 = template('<div>fallback</div>')()
              return n2
            })
            return n0
          },
        })

        const VaporForwardedSlot2 = defineVaporComponent({
          setup() {
            const createForwardedSlot = forwardedSlotCreator()
            const n2 = createComponent(
              VaporSlot,
              null,
              {
                foo: () => {
                  return createForwardedSlot('foo', null)
                },
              },
              true,
            )
            return n2
          },
        })

        const VaporForwardedSlot1 = defineVaporComponent({
          setup() {
            const createForwardedSlot = forwardedSlotCreator()
            const n2 = createComponent(
              VaporForwardedSlot2,
              null,
              {
                foo: () => {
                  return createForwardedSlot('foo', null)
                },
              },
              true,
            )
            return n2
          },
        })

        const App = {
          setup() {
            return () =>
              h(
                VaporForwardedSlot1 as any,
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

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span><!--slot--><!--slot-->')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot--><!--slot-->')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<!--slot--><!--slot--><div>fallback</div>')

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<!--slot--><!--slot--><span>bar</span>')
      })

      test('vdom slot > vapor forwarded slot(with fallback) > vapor forwarded slot(with fallback) > vdom slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VdomSlot = {
          render(this: any) {
            return renderSlot(this.$slots, 'foo', {}, () => [
              h('div', 'fallback'),
            ])
          },
        }

        const VaporForwardedSlot2WithFallback = defineVaporComponent({
          setup() {
            const createForwardedSlot = forwardedSlotCreator()
            const n2 = createComponent(
              VdomSlot as any,
              null,
              {
                foo: () => {
                  return createForwardedSlot('foo', null, () => {
                    const n2 = template('<div>vapor2 fallback</div>')()
                    return n2
                  })
                },
              },
              true,
            )
            return n2
          },
        })

        const VaporForwardedSlot1WithFallback = defineVaporComponent({
          setup() {
            const createForwardedSlot = forwardedSlotCreator()
            const n2 = createComponent(
              VaporForwardedSlot2WithFallback,
              null,
              {
                foo: () => {
                  return createForwardedSlot('foo', null, () => {
                    const n2 = template('<div>vapor1 fallback</div>')()
                    return n2
                  })
                },
              },
              true,
            )
            return n2
          },
        })

        const App = {
          setup() {
            return () =>
              h(
                VaporForwardedSlot1WithFallback as any,
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

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span><!--slot-->')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot-->')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<!--slot--><div>vapor1 fallback</div>')

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<!--slot--><span>bar</span>')
      })

      test('vdom slot > vapor forwarded slot(with fallback) > vapor forwarded slot(with fallback) > vapor slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VaporSlot = defineVaporComponent({
          setup() {
            const n0 = createSlot('foo', null, () => {
              const n2 = template('<div>fallback</div>')()
              return n2
            })
            return n0
          },
        })

        const VaporForwardedSlot2WithFallback = defineVaporComponent({
          setup() {
            const createForwardedSlot = forwardedSlotCreator()
            const n2 = createComponent(
              VaporSlot,
              null,
              {
                foo: () => {
                  return createForwardedSlot('foo', null, () => {
                    const n2 = template('<div>vapor2 fallback</div>')()
                    return n2
                  })
                },
              },
              true,
            )
            return n2
          },
        })

        const VaporForwardedSlot1WithFallback = defineVaporComponent({
          setup() {
            const createForwardedSlot = forwardedSlotCreator()
            const n2 = createComponent(
              VaporForwardedSlot2WithFallback,
              null,
              {
                foo: () => {
                  return createForwardedSlot('foo', null, () => {
                    const n2 = template('<div>vapor1 fallback</div>')()
                    return n2
                  })
                },
              },
              true,
            )
            return n2
          },
        })

        const App = {
          setup() {
            return () =>
              h(
                VaporForwardedSlot1WithFallback as any,
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

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span><!--slot--><!--slot-->')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot--><!--slot-->')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe(
          '<!--slot--><!--slot--><div>vapor1 fallback</div>',
        )

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<!--slot--><!--slot--><span>bar</span>')
      })

      test('vdom slot > vdom forwarded slot(with fallback) > vdom forwarded slot(with fallback) > vapor slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VaporSlot = defineVaporComponent({
          setup() {
            const n0 = createSlot('foo', null, () => {
              const n2 = template('<div>fallback</div>')()
              return n2
            })
            return n0
          },
        })

        const VdomForwardedSlot2WithFallback = {
          render(this: any) {
            return h(VaporSlot as any, null, {
              foo: () => [
                renderSlot(this.$slots, 'foo', {}, () => [
                  h('div', 'vdom2 fallback'),
                ]),
              ],
              _: 3 /* FORWARDED */,
            })
          },
        }

        const VdomForwardedSlot1WithFallback = {
          render(this: any) {
            return h(VdomForwardedSlot2WithFallback, null, {
              foo: () => [
                renderSlot(this.$slots, 'foo', {}, () => [
                  h('div', 'vdom1 fallback'),
                ]),
              ],
              _: 3 /* FORWARDED */,
            })
          },
        }

        const App = {
          setup() {
            return () =>
              h(
                VdomForwardedSlot1WithFallback,
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

        const VdomSlot = {
          render(this: any) {
            return renderSlot(this.$slots, 'foo', {}, () => [
              h('div', 'fallback'),
            ])
          },
        }

        const VdomForwardedSlot2WithFallback = {
          render(this: any) {
            return h(VdomSlot, null, {
              foo: () => [
                renderSlot(this.$slots, 'foo', {}, () => [
                  h('div', 'vdom2 fallback'),
                ]),
              ],
              _: 3 /* FORWARDED */,
            })
          },
        }

        const VdomForwardedSlot1WithFallback = {
          render(this: any) {
            return h(VdomForwardedSlot2WithFallback, null, {
              foo: () => [
                renderSlot(this.$slots, 'foo', {}, () => [
                  h('div', 'vdom1 fallback'),
                ]),
              ],
              _: 3 /* FORWARDED */,
            })
          },
        }

        const App = {
          setup() {
            return () =>
              h(
                VdomForwardedSlot1WithFallback,
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

        const VaporSlot = defineVaporComponent({
          setup() {
            const n0 = createSlot('foo', null, () => {
              const n2 = template('<div>fallback</div>')()
              return n2
            })
            return n0
          },
        })

        const VdomForwardedSlot3WithFallback = {
          render(this: any) {
            return h(VaporSlot as any, null, {
              foo: () => [
                renderSlot(this.$slots, 'foo', {}, () => [
                  h('div', 'vdom3 fallback'),
                ]),
              ],
              _: 3 /* FORWARDED */,
            })
          },
        }

        const VdomForwardedSlot2WithFallback = {
          render(this: any) {
            return h(VdomForwardedSlot3WithFallback, null, {
              foo: () => [
                renderSlot(this.$slots, 'foo', {}, () => [
                  h('div', 'vdom2 fallback'),
                ]),
              ],
              _: 3 /* FORWARDED */,
            })
          },
        }

        const VdomForwardedSlot1WithFallback = {
          render(this: any) {
            return h(VdomForwardedSlot2WithFallback, null, {
              foo: () => [
                renderSlot(this.$slots, 'foo', {}, () => [
                  h('div', 'vdom1 fallback'),
                ]),
              ],
              _: 3 /* FORWARDED */,
            })
          },
        }

        const App = {
          setup() {
            return () =>
              h(
                VdomForwardedSlot1WithFallback,
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
})
