import {
  createApp,
  getCurrentInstance,
  h,
  nextTick,
  nodeOps,
  ref,
  render,
} from '@vue/runtime-test'
import { createBlock, normalizeVNode } from '../src/vnode'
import { createSlots } from '../src/helpers/createSlots'

describe('component: slots', () => {
  function renderWithSlots(slots: any): any {
    let instance: any
    const Comp = {
      render() {
        instance = getCurrentInstance()
        return h('div')
      },
    }

    render(h(Comp, null, slots), nodeOps.createElement('div'))
    return instance
  }

  test('initSlots: instance.slots should be set correctly', () => {
    let instance: any
    const Comp = {
      render() {
        instance = getCurrentInstance()
        return h('div')
      },
    }
    const slots = { foo: () => {}, _: 1 }
    render(createBlock(Comp, null, slots), nodeOps.createElement('div'))
    expect(instance.slots).toMatchObject(slots)
  })

  test('initSlots: instance.slots should remove compiler marker if parent is using manual render function', () => {
    const { slots } = renderWithSlots({ _: 1 })
    expect(slots).toMatchObject({})
  })

  test('initSlots: should normalize object slots (when value is null, string, array)', () => {
    const { slots } = renderWithSlots({
      _inner: '_inner',
      foo: null,
      header: 'header',
      footer: ['f1', 'f2'],
    })

    expect(
      '[Vue warn]: Non-function value encountered for slot "header". Prefer function slots for better performance.',
    ).toHaveBeenWarned()

    expect(
      '[Vue warn]: Non-function value encountered for slot "footer". Prefer function slots for better performance.',
    ).toHaveBeenWarned()

    expect(slots).not.toHaveProperty('_inner')
    expect(slots).not.toHaveProperty('foo')
    expect(slots.header()).toMatchObject([normalizeVNode('header')])
    expect(slots.footer()).toMatchObject([
      normalizeVNode('f1'),
      normalizeVNode('f2'),
    ])
  })

  test('initSlots: should normalize object slots (when value is function)', () => {
    let proxy: any
    const Comp = {
      render() {
        proxy = getCurrentInstance()
        return h('div')
      },
    }

    render(
      h(Comp, null, {
        header: () => 'header',
      }),
      nodeOps.createElement('div'),
    )

    expect(proxy.slots.header()).toMatchObject([normalizeVNode('header')])
  })

  test('initSlots: instance.slots should be set correctly (when vnode.shapeFlag is not SLOTS_CHILDREN)', () => {
    const { slots } = renderWithSlots([h('span')])

    expect(
      '[Vue warn]: Non-function value encountered for default slot. Prefer function slots for better performance.',
    ).toHaveBeenWarned()

    expect(slots.default()).toMatchObject([normalizeVNode(h('span'))])
  })

  test('updateSlots: instance.slots should be updated correctly (when slotType is number)', async () => {
    const flag1 = ref(true)

    let instance: any
    const Child = () => {
      instance = getCurrentInstance()
      return 'child'
    }

    const Comp = {
      setup() {
        return () => [
          h(
            Child,
            null,
            createSlots({ _: 2 as any }, [
              flag1.value
                ? {
                    name: 'one',
                    fn: () => [h('span')],
                  }
                : {
                    name: 'two',
                    fn: () => [h('div')],
                  },
            ]),
          ),
        ]
      },
    }
    render(h(Comp), nodeOps.createElement('div'))

    expect(instance.slots).toHaveProperty('one')
    expect(instance.slots).not.toHaveProperty('two')

    flag1.value = false
    await nextTick()

    expect(instance.slots).not.toHaveProperty('one')
    expect(instance.slots).toHaveProperty('two')
  })

  test('updateSlots: instance.slots should be updated correctly (when slotType is null)', async () => {
    const flag1 = ref(true)

    let instance: any
    const Child = () => {
      instance = getCurrentInstance()
      return 'child'
    }

    const oldSlots = {
      header: 'header',
      footer: undefined,
    }
    const newSlots = {
      header: undefined,
      footer: 'footer',
    }

    const Comp = {
      setup() {
        return () => [
          h(Child, { n: flag1.value }, flag1.value ? oldSlots : newSlots),
        ]
      },
    }
    render(h(Comp), nodeOps.createElement('div'))

    expect(instance.slots).toHaveProperty('header')
    expect(instance.slots).not.toHaveProperty('footer')

    flag1.value = false
    await nextTick()

    expect(
      '[Vue warn]: Non-function value encountered for slot "header". Prefer function slots for better performance.',
    ).toHaveBeenWarned()

    expect(
      '[Vue warn]: Non-function value encountered for slot "footer". Prefer function slots for better performance.',
    ).toHaveBeenWarned()

    expect(instance.slots).not.toHaveProperty('header')
    expect(instance.slots.footer()).toMatchObject([normalizeVNode('footer')])
  })

  test('updateSlots: instance.slots should be update correctly (when vnode.shapeFlag is not SLOTS_CHILDREN)', async () => {
    const flag1 = ref(true)

    let instance: any
    const Child = () => {
      instance = getCurrentInstance()
      return 'child'
    }

    const Comp = {
      setup() {
        return () => [
          h(Child, { n: flag1.value }, flag1.value ? ['header'] : ['footer']),
        ]
      },
    }
    render(h(Comp), nodeOps.createElement('div'))

    expect(instance.slots.default()).toMatchObject([normalizeVNode('header')])

    flag1.value = false
    await nextTick()

    expect(
      '[Vue warn]: Non-function value encountered for default slot. Prefer function slots for better performance.',
    ).toHaveBeenWarned()

    expect(instance.slots.default()).toMatchObject([normalizeVNode('footer')])
  })

  test('should respect $stable flag with a value of true', async () => {
    const flag1 = ref(1)
    const flag2 = ref(2)
    const spy = vi.fn()

    const Child = () => {
      spy()
      return 'child'
    }

    const App = {
      setup() {
        return () => [
          flag1.value,
          h(
            Child,
            { n: flag2.value },
            {
              foo: () => 'foo',
              $stable: true,
            },
          ),
        ]
      },
    }

    render(h(App), nodeOps.createElement('div'))
    expect(spy).toHaveBeenCalledTimes(1)

    // parent re-render, props didn't change, slots are stable
    // -> child should not update
    flag1.value++
    await nextTick()
    expect(spy).toHaveBeenCalledTimes(1)

    // parent re-render, props changed
    // -> child should update
    flag2.value++
    await nextTick()
    expect(spy).toHaveBeenCalledTimes(2)
  })

  test('should respect $stable flag with a value of false', async () => {
    const flag1 = ref(1)
    const flag2 = ref(2)
    const spy = vi.fn()

    const Child = () => {
      spy()
      return 'child'
    }

    const App = {
      setup() {
        return () => [
          flag1.value,
          h(
            Child,
            { n: flag2.value },
            {
              foo: () => 'foo',
              $stable: false,
            },
          ),
        ]
      },
    }

    render(h(App), nodeOps.createElement('div'))
    expect(spy).toHaveBeenCalledTimes(1)

    // parent re-render, props didn't change, slots are not stable
    // -> child should update
    flag1.value++
    await nextTick()
    expect(spy).toHaveBeenCalledTimes(2)

    // parent re-render, props changed
    // -> child should update
    flag2.value++
    await nextTick()
    expect(spy).toHaveBeenCalledTimes(3)
  })

  test('should not warn when mounting another app in setup', () => {
    const Comp = {
      setup(_: any, { slots }: any) {
        return () => slots.default?.()
      },
    }

    const mountComp = () => {
      createApp({
        setup() {
          return () => h(Comp, () => 'msg')
        },
      }).mount(nodeOps.createElement('div'))
    }

    const App = {
      setup() {
        mountComp()
        return () => null
      },
    }

    createApp(App).mount(nodeOps.createElement('div'))
    expect(
      'Slot "default" invoked outside of the render function',
    ).not.toHaveBeenWarned()
  })
})
