// NOTE: This test is implemented based on the case of `runtime-core/__test__/componentSlots.spec.ts`.

import {
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
  setText,
  template,
} from '../src'
import {
  type ComponentInternalInstance,
  currentInstance,
  getCurrentInstance,
  nextTick,
  ref,
  useSlots,
} from '@vue/runtime-dom'
import { makeRender } from './_utils'

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

  test.todo('should work with createFlorSlots', async () => {
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
              // @ts-expect-error
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
              setText(el, props.title)
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
                  setText(el, props.title)
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

    // test case could be previewed at
    // https://deploy-preview-241--vapor-repl.netlify.app/#__VAPOR__eNp9VMtu2zAQ/JWFcrAMOBKC9JRKQR/IoT00RVP0YuWgSCuFNkUK4kq1Yfjfu6QefsQNYAPi7nC4HM7uzvtc10HXonfnRSZrRE1gkNoaZKrKOPHIJN59okRV64bgq65qKBpdwSwI7cJunX2c8jtosID9ALG5RCUq08oQEG4IYgvwZzkWaStpNh+TadMMueXNYkov4PaZIYkqWpWR0ApIl6VEfw67RAGIAnzeGXSpbDGQqEp6hTiO4XYAgCXu00y/vHm2wT2gNHgZcHq2QyeKf1HYi8NS8IKwqmVKyCuASKi6JeiuK52jtJLxRRMPwj5rVXJf/D3ug6vhlCEBYCglkcEQHuDhyTkAb1iW9qjniSTfqrRilt2uF3vPhb8hOifprgvdcNWCIyCU1YOLv1ra9YFaal3fWWIHu0hsl9Nlo5eWiN/rUyZFtraiuIdjL/UfUdgDGHxC4i08oXLcBK9UySNP0rZGZmGJW8cy1sUeGJ2XNcgcf1JesqePTRh2NshWPNtjYaOZhzY4Ap3y+fyfB5VuFfmzq7SuZ/PJE1EuOhA518dxLi4KOXDPVyHD7i5EGayMVnwbZ7nEy1glIbF5rK2nucFY2eGFvVRK/fe7i1HT4mKMZ6+YrS/EV2ZjY4n3s0GDTcfiTDlKmxLZijb98PTD2XJKjlK+k/yFRsvW1tjDvrQq57KPcK7ab05Nocrf5mFDqMx4KVuoayGHTzzW1xrkf1c/lHsbfBhbj1Uc58z5iDqMpR20Bp+kJnPh2Xk6jVPGOEg8of1p/qxxaxM8WOJ7eHxZYUaBjfluC8PeGQDcFQ46H/rC2WFsK86ALgbAZNzI0sIdt6t1NScP88J557wr9v8AXg7dEA==
    test('should not delete new rendered slot when the old slot is removed in loop slot', async () => {
      const loop = ref([1, 'default', 3])

      let childInstance
      const t0 = template('<div></div>')
      const { component: Child } = define({
        setup() {
          childInstance = getCurrentInstance()
          const slots = useSlots()
          const keys = () => Object.keys(slots)
          return {
            keys,
            slots,
          }
        },
        render: (_ctx: any) => {
          const n0 = createFor(
            () => _ctx.keys(),
            (_ctx0: any) => {
              const n5 = t0()
              const n4 = createSlot(() => _ctx0[0])
              insert(n4, n5 as ParentNode)
              return n5
            },
          )
          return n0
        },
      })

      const t1 = template(' static default ')
      const { render } = define({
        setup() {
          return createComponent(
            Child,
            {},
            {
              default: () => {
                return t1()
              },
              $: [
                () =>
                  // @ts-expect-error TODO createForSlots
                  createForSlots(loop.value, (item, i) => ({
                    name: item,
                    fn: () => template(item)(),
                  })),
              ],
            },
          )
        },
      })
      const { html } = render()

      expect(childInstance!.slots).toHaveProperty('1')
      expect(childInstance!.slots).toHaveProperty('default')
      expect(childInstance!.slots).toHaveProperty('3')
      expect(html()).toBe(
        '<div>1<!--slot--></div><div>3<!--slot--></div><div>default<!--slot--></div><!--for-->',
      )
      loop.value = [1]
      await nextTick()
      expect(childInstance!.slots).toHaveProperty('1')
      expect(childInstance!.slots).toHaveProperty('default')
      expect(childInstance!.slots).not.toHaveProperty('3')
      expect(html()).toBe(
        '<div>1<!--slot--></div><div> static default <!--slot--></div><!--for-->',
      )
    })

    test('should cleanup all slots when loop slot has same key', async () => {
      const loop = ref([1, 1, 1])

      let childInstance
      const t0 = template('<div></div>')
      const { component: Child } = define({
        setup() {
          childInstance = getCurrentInstance()
          const slots = useSlots()
          const keys = () => Object.keys(slots)
          return {
            keys,
            slots,
          }
        },
        render: (_ctx: any) => {
          const n0 = createFor(
            () => _ctx.keys(),
            (_ctx0: any) => {
              const n5 = t0()
              const n4 = createSlot(() => _ctx0[0])
              insert(n4, n5 as ParentNode)
              return n5
            },
          )
          return n0
        },
      })

      const t1 = template(' static default ')
      const { render } = define({
        setup() {
          return createComponent(
            Child,
            {},
            {
              default: () => {
                return t1()
              },
              $: [
                () =>
                  // @ts-expect-error TODO createForSlots
                  createForSlots(loop.value, (item, i) => ({
                    name: item,
                    fn: () => template(item)(),
                  })),
              ],
            },
          )
        },
      })
      const { html } = render()
      expect(childInstance!.slots).toHaveProperty('1')
      expect(childInstance!.slots).toHaveProperty('default')
      expect(html()).toBe(
        '<div>1<!--slot--></div><div> static default <!--slot--></div><!--for-->',
      )
      loop.value = [1]
      await nextTick()
      expect(childInstance!.slots).toHaveProperty('1')
      expect(childInstance!.slots).toHaveProperty('default')
      expect(html()).toBe(
        '<div>1<!--slot--></div><div> static default <!--slot--></div><!--for-->',
      )
      loop.value = [1, 2, 3]
      await nextTick()
      expect(childInstance!.slots).toHaveProperty('1')
      expect(childInstance!.slots).toHaveProperty('2')
      expect(childInstance!.slots).toHaveProperty('3')
      expect(childInstance!.slots).toHaveProperty('default')
      expect(html()).toBe(
        '<div>1<!--slot--></div><div>2<!--slot--></div><div>3<!--slot--></div><div> static default <!--slot--></div><!--for-->',
      )
    })

    test('dynamicSlots should not cover high level slots', async () => {
      const dynamicFlag = ref(true)

      let instance: ComponentInternalInstance
      const { component: Child } = define({
        render() {
          instance = getCurrentInstance()!
          return [createSlot('default'), createSlot('others')]
        },
      })

      const { render, html } = define({
        render() {
          return createComponent(
            Child,
            {},
            {
              default: () => template('default')(),
              $: [
                () =>
                  dynamicFlag.value
                    ? {
                        name: 'default',
                        fn: () => template('dynamic default')(),
                      }
                    : { name: 'others', fn: () => template('others')() },
              ],
            },
          )
        },
      })

      render()

      expect(html()).toBe('default<!--slot--><!--slot-->')

      dynamicFlag.value = false
      await nextTick()

      expect(html()).toBe('default<!--slot-->others<!--slot-->')
      expect(instance!.slots).haveOwnProperty('others')

      dynamicFlag.value = true
      await nextTick()
      expect(html()).toBe('default<!--slot--><!--slot-->')
      expect(instance!.slots).not.haveOwnProperty('others')
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
  })
})
