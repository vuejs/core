// NOTE: This test is implemented based on the case of `runtime-core/__test__/componentSlots.spec.ts`.

import {
  child,
  createComponent,
  createFor,
  createForSlots,
  createIf,
  createSlot,
  createVaporApp,
  defineVaporComponent,
  insert,
  prepend,
  renderEffect,
  setInsertionState,
  template,
  vaporInteropPlugin,
  withVaporCtx,
} from '../src'
import {
  type Ref,
  createApp,
  createSlots,
  currentInstance,
  h,
  nextTick,
  ref,
  renderSlot,
  toDisplayString,
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

    test('render fallback when slot content is not valid', async () => {
      const Child = {
        setup() {
          return createSlot('default', null, () =>
            document.createTextNode('fallback'),
          )
        },
      }

      const { html } = define({
        setup() {
          return createComponent(Child, null, {
            default: () => {
              return template('<!--comment-->')()
            },
          })
        },
      }).render()

      expect(html()).toBe('fallback<!--slot-->')
    })

    test('render fallback when v-if condition is false', async () => {
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

    test('render fallback with nested v-if', async () => {
      const Child = {
        setup() {
          return createSlot('default', null, () =>
            document.createTextNode('fallback'),
          )
        },
      }

      const outerShow = ref(false)
      const innerShow = ref(false)

      const { html } = define({
        setup() {
          return createComponent(Child, null, {
            default: () => {
              return createIf(
                () => outerShow.value,
                () => {
                  return createIf(
                    () => innerShow.value,
                    () => {
                      return document.createTextNode('content')
                    },
                  )
                },
              )
            },
          })
        },
      }).render()

      expect(html()).toBe('fallback<!--if--><!--slot-->')

      outerShow.value = true
      await nextTick()
      expect(html()).toBe('fallback<!--if--><!--if--><!--slot-->')

      innerShow.value = true
      await nextTick()
      expect(html()).toBe('content<!--if--><!--if--><!--slot-->')

      innerShow.value = false
      await nextTick()
      expect(html()).toBe('fallback<!--if--><!--if--><!--slot-->')

      outerShow.value = false
      await nextTick()
      expect(html()).toBe('fallback<!--if--><!--slot-->')

      outerShow.value = true
      await nextTick()
      expect(html()).toBe('fallback<!--if--><!--if--><!--slot-->')

      innerShow.value = true
      await nextTick()
      expect(html()).toBe('content<!--if--><!--if--><!--slot-->')
    })

    test('render fallback with v-for', async () => {
      const Child = {
        setup() {
          return createSlot('default', null, () =>
            document.createTextNode('fallback'),
          )
        },
      }

      const items = ref<number[]>([1])
      const { html } = define({
        setup() {
          return createComponent(Child, null, {
            default: () => {
              const n2 = createFor(
                () => items.value,
                for_item0 => {
                  const n4 = template('<span> </span>')() as any
                  const x4 = child(n4) as any
                  renderEffect(() =>
                    setText(x4, toDisplayString(for_item0.value)),
                  )
                  return n4
                },
              )
              return n2
            },
          })
        },
      }).render()

      expect(html()).toBe('<span>1</span><!--for--><!--slot-->')

      items.value.pop()
      await nextTick()
      expect(html()).toBe('fallback<!--for--><!--slot-->')

      items.value.pop()
      await nextTick()
      expect(html()).toBe('fallback<!--for--><!--slot-->')

      items.value.push(2)
      await nextTick()
      expect(html()).toBe('<span>2</span><!--for--><!--slot-->')
    })

    test('render fallback with v-for (empty source)', async () => {
      const Child = {
        setup() {
          return createSlot('default', null, () =>
            document.createTextNode('fallback'),
          )
        },
      }

      const items = ref<number[]>([])
      const { html } = define({
        setup() {
          return createComponent(Child, null, {
            default: () => {
              const n2 = createFor(
                () => items.value,
                for_item0 => {
                  const n4 = template('<span> </span>')() as any
                  const x4 = child(n4) as any
                  renderEffect(() =>
                    setText(x4, toDisplayString(for_item0.value)),
                  )
                  return n4
                },
              )
              return n2
            },
          })
        },
      }).render()

      expect(html()).toBe('fallback<!--for--><!--slot-->')

      items.value.push(1)
      await nextTick()
      expect(html()).toBe('<span>1</span><!--for--><!--slot-->')

      items.value.pop()
      await nextTick()
      expect(html()).toBe('fallback<!--for--><!--slot-->')

      items.value.pop()
      await nextTick()
      expect(html()).toBe('fallback<!--for--><!--slot-->')

      items.value.push(2)
      await nextTick()
      expect(html()).toBe('<span>2</span><!--for--><!--slot-->')
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
          const n2 = createComponent(
            Child,
            null,
            {
              foo: withVaporCtx(() => {
                return createSlot('foo', null)
              }),
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
          const n2 = createComponent(Child, null, {
            foo: withVaporCtx(() => {
              const n0 = createSlot('foo', null)
              return n0
            }),
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

    test('forwarded slot with fallback', async () => {
      const Child = defineVaporComponent({
        setup() {
          return createSlot('default', null, () => template('child fallback')())
        },
      })

      const Parent = defineVaporComponent({
        setup() {
          const n2 = createComponent(Child, null, {
            default: withVaporCtx(() => {
              const n0 = createSlot('default', null, () => {
                return template('<!-- <div></div> -->')()
              })
              return n0
            }),
          })
          return n2
        },
      })

      const { html } = define({
        setup() {
          return createComponent(Parent, null, {
            default: () => template('<!-- <div>App</div> -->')(),
          })
        },
      }).render()

      expect(html()).toBe('child fallback<!--slot--><!--slot-->')
    })

    test('forwarded slot with fallback (v-if)', async () => {
      const Child = defineVaporComponent({
        setup() {
          return createSlot('default', null, () => template('child fallback')())
        },
      })

      const show = ref(false)
      const Parent = defineVaporComponent({
        setup() {
          const n2 = createComponent(Child, null, {
            default: withVaporCtx(() => {
              const n0 = createSlot('default', null, () => {
                const n2 = createIf(
                  () => show.value,
                  () => {
                    const n4 = template('<div>if content</div>')()
                    return n4
                  },
                )
                return n2
              })
              return n0
            }),
          })
          return n2
        },
      })

      const { html } = define({
        setup() {
          return createComponent(Parent, null, {
            default: () => template('<!-- <div>App</div> -->')(),
          })
        },
      }).render()

      expect(html()).toBe('child fallback<!--if--><!--slot--><!--slot-->')

      show.value = true
      await nextTick()
      expect(html()).toBe(
        '<div>if content</div><!--if--><!--slot--><!--slot-->',
      )
    })

    test('forwarded slot with fallback (v-for)', async () => {
      const Child = defineVaporComponent({
        setup() {
          return createSlot('default', null, () => template('child fallback')())
        },
      })

      const items = ref<number[]>([])
      const Parent = defineVaporComponent({
        setup() {
          const n2 = createComponent(Child, null, {
            default: withVaporCtx(() => {
              const n0 = createSlot('default', null, () => {
                const n2 = createFor(
                  () => items.value,
                  for_item0 => {
                    const n4 = template('<span> </span>')() as any
                    const x4 = child(n4) as any
                    renderEffect(() =>
                      setText(x4, toDisplayString(for_item0.value)),
                    )
                    return n4
                  },
                )
                return n2
              })
              return n0
            }),
          })
          return n2
        },
      })

      const { html } = define({
        setup() {
          return createComponent(Parent, null, {
            default: () => template('<!-- <div>App</div> -->')(),
          })
        },
      }).render()

      expect(html()).toBe('child fallback<!--for--><!--slot--><!--slot-->')

      items.value.push(1)
      await nextTick()
      expect(html()).toBe('<span>1</span><!--for--><!--slot--><!--slot-->')

      items.value.pop()
      await nextTick()
      expect(html()).toBe('child fallback<!--for--><!--slot--><!--slot-->')
    })

    describe('vdom interop', () => {
      const createVaporSlot = (fallbackText = 'fallback') => {
        return defineVaporComponent({
          setup() {
            const n0 = createSlot('foo', null, () => {
              const n2 = template(`<div>${fallbackText}</div>`)()
              return n2
            })
            return n0
          },
        })
      }

      const createVdomSlot = (fallbackText = 'fallback') => {
        return {
          render(this: any) {
            return renderSlot(this.$slots, 'foo', {}, () => [
              h('div', fallbackText),
            ])
          },
        }
      }

      const createVaporForwardedSlot = (
        targetComponent: any,
        fallbackText?: string,
      ) => {
        return defineVaporComponent({
          setup() {
            const n2 = createComponent(
              targetComponent,
              null,
              {
                foo: withVaporCtx(() => {
                  return fallbackText
                    ? createSlot('foo', null, () => {
                        const n2 = template(`<div>${fallbackText}</div>`)()
                        return n2
                      })
                    : createSlot('foo', null)
                }),
              },
              true,
            )
            return n2
          },
        })
      }

      const createVdomForwardedSlot = (
        targetComponent: any,
        fallbackText?: string,
      ) => {
        return {
          render(this: any) {
            return h(targetComponent, null, {
              foo: () => [
                fallbackText
                  ? renderSlot(this.$slots, 'foo', {}, () => [
                      h('div', fallbackText),
                    ])
                  : renderSlot(this.$slots, 'foo'),
              ],
              _: 3 /* FORWARDED */,
            })
          },
        }
      }

      const createMultipleVaporForwardedSlots = (
        targetComponent: any,
        count: number,
      ) => {
        let current = targetComponent
        for (let i = 0; i < count; i++) {
          current = createVaporForwardedSlot(current)
        }
        return current
      }

      const createMultipleVdomForwardedSlots = (
        targetComponent: any,
        count: number,
      ) => {
        let current = targetComponent
        for (let i = 0; i < count; i++) {
          current = createVdomForwardedSlot(current)
        }
        return current
      }

      const createTestApp = (
        rootComponent: any,
        foo: Ref<string>,
        show: Ref<Boolean>,
      ) => {
        return {
          setup() {
            return () =>
              h(
                rootComponent,
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
      }

      const createEmptyTestApp = (rootComponent: any) => {
        return {
          setup() {
            return () => h(rootComponent)
          },
        }
      }

      test('vdom slot > vapor forwarded slot > vapor slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VaporSlot = createVaporSlot()
        const VaporForwardedSlot = createVaporForwardedSlot(VaporSlot)
        const App = createTestApp(VaporForwardedSlot, foo, show)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span><!--slot-->')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot-->')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<div>fallback</div><!--slot-->')
      })

      test('vdom slot > vapor forwarded slot(with fallback) > vapor slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VaporSlot = createVaporSlot()
        const VaporForwardedSlotWithFallback = createVaporForwardedSlot(
          VaporSlot,
          'forwarded fallback',
        )
        const App = createTestApp(VaporForwardedSlotWithFallback, foo, show)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span><!--slot-->')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot-->')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<div>forwarded fallback</div><!--slot-->')
      })

      test('vdom slot > vapor forwarded slot > vdom slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VdomSlot = createVdomSlot()
        const VaporForwardedSlot = createVaporForwardedSlot(VdomSlot)
        const App = createTestApp(VaporForwardedSlot, foo, show)

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

        const VdomSlot = createVdomSlot()
        const VaporForwardedSlotWithFallback = createVaporForwardedSlot(
          VdomSlot,
          'forwarded fallback',
        )
        const App = createTestApp(VaporForwardedSlotWithFallback, foo, show)

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

        const VaporSlot = createVaporSlot()
        const VdomForwardedSlot = createVdomForwardedSlot(VaporSlot)
        const VaporForwardedSlot = createVaporForwardedSlot(VdomForwardedSlot)
        const App = createTestApp(VaporForwardedSlot, foo, show)

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

        const VaporSlot = createVaporSlot()
        const VdomForwardedSlot = createVdomForwardedSlot(VaporSlot)
        const VaporForwardedSlotWithFallback = createVaporForwardedSlot(
          VdomForwardedSlot,
          'forwarded fallback',
        )
        const App = createTestApp(VaporForwardedSlotWithFallback, foo, show)

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

        const VaporSlot = createVaporSlot()
        const VdomForwardedSlotWithFallback = createVdomForwardedSlot(
          VaporSlot,
          'vdom fallback',
        )
        const VaporForwardedSlot = createVaporForwardedSlot(
          VdomForwardedSlotWithFallback,
        )
        const App = createTestApp(VaporForwardedSlot, foo, show)

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
        const VaporSlot = createVaporSlot()
        const VdomForwardedSlotWithFallback = createVdomForwardedSlot(
          VaporSlot,
          'vdom fallback',
        )
        const VaporForwardedSlot = createVaporForwardedSlot(
          VdomForwardedSlotWithFallback,
        )
        const App = createEmptyTestApp(VaporForwardedSlot)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<div>vdom fallback</div>')
      })

      test('vdom slot > vapor forwarded slot > vdom forwarded slot > vdom slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VdomSlot = createVdomSlot()
        const VdomForwardedSlot = createVdomForwardedSlot(VdomSlot)
        const VaporForwardedSlot = createVaporForwardedSlot(VdomForwardedSlot)
        const App = createTestApp(VaporForwardedSlot, foo, show)

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

        const VdomSlot = createVdomSlot()
        const VdomForwardedSlot = createVdomForwardedSlot(VdomSlot)
        const VaporForwardedSlotWithFallback = createVaporForwardedSlot(
          VdomForwardedSlot,
          'vapor fallback',
        )
        const App = createTestApp(VaporForwardedSlotWithFallback, foo, show)

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

        const VdomSlot = createVdomSlot()

        const VdomForwardedSlotWithFallback = createVdomForwardedSlot(
          VdomSlot,
          'vdom fallback',
        )
        const VaporForwardedSlot = createVaporForwardedSlot(
          VdomForwardedSlotWithFallback,
        )
        const App = createTestApp(VaporForwardedSlot, foo, show)

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

        const VdomSlot = createVdomSlot()
        const VdomForwardedSlot = createVdomForwardedSlot(VdomSlot)
        const VaporForwardedSlot = createMultipleVaporForwardedSlots(
          VdomForwardedSlot,
          3,
        )
        const App = createTestApp(VaporForwardedSlot, foo, show)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span><!--slot--><!--slot-->')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot--><!--slot-->')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<div>fallback</div><!--slot--><!--slot-->')

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot--><!--slot-->')
      })

      test('vdom slot > vapor forwarded slot (multiple) > vdom forwarded slot(with fallback) > vdom slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VdomSlot = createVdomSlot()
        const VdomForwardedSlotWithFallback = createVdomForwardedSlot(
          VdomSlot,
          'vdom fallback',
        )
        const VaporForwardedSlot = createMultipleVaporForwardedSlots(
          VdomForwardedSlotWithFallback,
          3,
        )
        const App = createTestApp(VaporForwardedSlot, foo, show)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span><!--slot--><!--slot-->')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot--><!--slot-->')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe(
          '<div>vdom fallback</div><!--slot--><!--slot-->',
        )

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot--><!--slot-->')
      })

      test('vdom slot > vdom forwarded slot > vapor slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VaporSlot = createVaporSlot()
        const VdomForwardedSlot = createVdomForwardedSlot(VaporSlot)
        const App = createTestApp(VdomForwardedSlot, foo, show)

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

        const VaporSlot = createVaporSlot()
        const VaporForwardedSlot = createVaporForwardedSlot(VaporSlot)
        const VdomForwardedSlot = createVdomForwardedSlot(VaporForwardedSlot)
        const App = createTestApp(VdomForwardedSlot, foo, show)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span><!--slot-->')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot-->')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<div>fallback</div><!--slot-->')

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot-->')
      })

      test('vdom slot > vdom forwarded slot (multiple) > vapor forwarded slot > vdom slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VaporSlot = createVaporSlot()
        const VaporForwardedSlot = createVaporForwardedSlot(VaporSlot)
        const VdomForwardedSlot = createMultipleVdomForwardedSlots(
          VaporForwardedSlot,
          3,
        )
        const App = createTestApp(VdomForwardedSlot, foo, show)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span><!--slot-->')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot-->')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<div>fallback</div><!--slot-->')

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot-->')
      })

      test('vdom slot > vdom forwarded slot (multiple) > vapor forwarded slot(with fallback) > vdom slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VaporSlot = createVaporSlot()
        const VaporForwardedSlot = createVaporForwardedSlot(
          VaporSlot,
          'vapor fallback',
        )
        const VdomForwardedSlot = createMultipleVdomForwardedSlots(
          VaporForwardedSlot,
          3,
        )
        const App = createTestApp(VdomForwardedSlot, foo, show)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span><!--slot-->')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot-->')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<div>vapor fallback</div><!--slot-->')

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot-->')
      })

      test('vdom slot > vapor forwarded slot > vapor forwarded slot > vdom slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VdomSlot = createVdomSlot()
        const VaporForwardedSlot1 = createMultipleVaporForwardedSlots(
          VdomSlot,
          2,
        )
        const App = createTestApp(VaporForwardedSlot1, foo, show)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span><!--slot-->')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot-->')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<div>fallback</div><!--slot-->')

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot-->')
      })

      test('vdom slot > vapor forwarded slot(with fallback) > vapor forwarded slot > vdom slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VdomSlot = createVdomSlot()
        const VaporForwardedSlot2 = createVaporForwardedSlot(VdomSlot)
        const VaporForwardedSlot1WithFallback = createVaporForwardedSlot(
          VaporForwardedSlot2,
          'vapor1 fallback',
        )
        const App = createTestApp(VaporForwardedSlot1WithFallback, foo, show)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span><!--slot-->')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot-->')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<div>vapor1 fallback</div><!--slot-->')

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot-->')
      })

      test('vdom slot > vapor forwarded slot > vapor forwarded slot(with fallback) > vdom slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VdomSlot = createVdomSlot()
        const VaporForwardedSlot2WithFallback = createVaporForwardedSlot(
          VdomSlot,
          'vapor2 fallback',
        )
        const VaporForwardedSlot1 = createVaporForwardedSlot(
          VaporForwardedSlot2WithFallback,
        )
        const App = createTestApp(VaporForwardedSlot1, foo, show)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span><!--slot-->')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot-->')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<div>vapor2 fallback</div><!--slot-->')

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot-->')
      })

      test('vdom slot > vapor forwarded slot > vapor forwarded slot > vapor slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VaporSlot = createVaporSlot()
        const VaporForwardedSlot2 = createVaporForwardedSlot(VaporSlot)
        const VaporForwardedSlot1 =
          createVaporForwardedSlot(VaporForwardedSlot2)
        const App = createTestApp(VaporForwardedSlot1, foo, show)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span><!--slot--><!--slot-->')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot--><!--slot-->')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<div>fallback</div><!--slot--><!--slot-->')

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot--><!--slot-->')
      })

      test('vdom slot > vapor forwarded slot(with fallback) > vapor forwarded slot(with fallback) > vdom slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VdomSlot = createVdomSlot()
        const VaporForwardedSlot2WithFallback = createVaporForwardedSlot(
          VdomSlot,
          'vapor2 fallback',
        )
        const VaporForwardedSlot1WithFallback = createVaporForwardedSlot(
          VaporForwardedSlot2WithFallback,
          'vapor1 fallback',
        )
        const App = createTestApp(VaporForwardedSlot1WithFallback, foo, show)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span><!--slot-->')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot-->')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe('<div>vapor1 fallback</div><!--slot-->')

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot-->')
      })

      test('vdom slot > vapor forwarded slot(with fallback) > vapor forwarded slot(with fallback) > vapor slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VaporSlot = createVaporSlot()
        const VaporForwardedSlot2WithFallback = createVaporForwardedSlot(
          VaporSlot,
          'vapor2 fallback',
        )
        const VaporForwardedSlot1WithFallback = createVaporForwardedSlot(
          VaporForwardedSlot2WithFallback,
          'vapor1 fallback',
        )
        const App = createTestApp(VaporForwardedSlot1WithFallback, foo, show)

        const root = document.createElement('div')
        createApp(App).use(vaporInteropPlugin).mount(root)
        expect(root.innerHTML).toBe('<span>foo</span><!--slot--><!--slot-->')

        foo.value = 'bar'
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot--><!--slot-->')

        show.value = false
        await nextTick()
        expect(root.innerHTML).toBe(
          '<div>vapor1 fallback</div><!--slot--><!--slot-->',
        )

        show.value = true
        await nextTick()
        expect(root.innerHTML).toBe('<span>bar</span><!--slot--><!--slot-->')
      })

      test('vdom slot > vdom forwarded slot(with fallback) > vdom forwarded slot(with fallback) > vapor slot', async () => {
        const foo = ref('foo')
        const show = ref(true)

        const VaporSlot = createVaporSlot()
        const VdomForwardedSlot2WithFallback = createVdomForwardedSlot(
          VaporSlot,
          'vdom2 fallback',
        )
        const VdomForwardedSlot1WithFallback = createVdomForwardedSlot(
          VdomForwardedSlot2WithFallback,
          'vdom1 fallback',
        )
        const App = createTestApp(VdomForwardedSlot1WithFallback, foo, show)

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

        const VdomSlot = createVdomSlot()
        const VdomForwardedSlot2WithFallback = createVdomForwardedSlot(
          VdomSlot,
          'vdom2 fallback',
        )
        const VdomForwardedSlot1WithFallback = createVdomForwardedSlot(
          VdomForwardedSlot2WithFallback,
          'vdom1 fallback',
        )
        const App = createTestApp(VdomForwardedSlot1WithFallback, foo, show)

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

        const VaporSlot = createVaporSlot()
        const VdomForwardedSlot3WithFallback = createVdomForwardedSlot(
          VaporSlot,
          'vdom3 fallback',
        )
        const VdomForwardedSlot2WithFallback = createVdomForwardedSlot(
          VdomForwardedSlot3WithFallback,
          'vdom2 fallback',
        )
        const VdomForwardedSlot1WithFallback = createVdomForwardedSlot(
          VdomForwardedSlot2WithFallback,
          'vdom1 fallback',
        )
        const App = createTestApp(VdomForwardedSlot1WithFallback, foo, show)

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

    test('consecutive slots with insertion state', async () => {
      const { component: Child } = define({
        setup() {
          const n2 = template('<div><div>baz</div></div>', true)() as any
          setInsertionState(n2, 0)
          createSlot('default', null)
          setInsertionState(n2, 0)
          createSlot('foo', null)
          return n2
        },
      })

      const { html } = define({
        setup() {
          return createComponent(Child, null, {
            default: () => template('default')(),
            foo: () => template('foo')(),
          })
        },
      }).render()

      expect(html()).toBe(
        `<div>` +
          `default<!--slot-->` +
          `foo<!--slot-->` +
          `<div>baz</div>` +
          `</div>`,
      )
    })
  })
})
