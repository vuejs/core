// NOTE: This test is implemented based on the case of `runtime-core/__test__/componentSlots.spec.ts`.

import {
  createComponent,
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
} from '../src'
import { currentInstance, nextTick, ref } from '@vue/runtime-dom'
import { makeRender } from './_utils'
import type { DynamicSlot } from '../src/componentSlots'
import { setElementText } from '../src/dom/prop'

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
