import {
  ref,
  render,
  h,
  nodeOps,
  nextTick,
  getCurrentInstance
} from '@vue/runtime-test'
import { normalizeVNode } from '../src/vnode'

describe('component: slots', () => {
  test('initSlots: instance.slots should be set correctly', () => {
    let proxy: any
    const Comp = {
      render() {
        proxy = getCurrentInstance()
        return h('div')
      }
    }

    render(h(Comp, null, { _: 1 }), nodeOps.createElement('div'))
    expect(proxy.slots).toMatchObject({ _: 1 })
  })

  test('initSlots: should normalize object slots (when value is null, string, array)', () => {
    let proxy: any
    const Comp = {
      render() {
        proxy = getCurrentInstance()
        return h('div')
      }
    }

    render(
      h(Comp, null, {
        _inner: '_inner',
        foo: null,
        header: 'header',
        footer: ['f1', 'f2']
      }),
      nodeOps.createElement('div')
    )

    expect(
      '[Vue warn]: Non-function value encountered for slot "header". Prefer function slots for better performance.'
    ).toHaveBeenWarned()

    expect(
      '[Vue warn]: Non-function value encountered for slot "footer". Prefer function slots for better performance.'
    ).toHaveBeenWarned()

    expect(proxy.slots).not.toHaveProperty('_inner')
    expect(proxy.slots).not.toHaveProperty('foo')
    expect(proxy.slots.header()).toMatchObject([normalizeVNode('header')])
    expect(proxy.slots.footer()).toMatchObject([
      normalizeVNode('f1'),
      normalizeVNode('f2')
    ])
  })

  test('initSlots: should normalize object slots (when value is function)', () => {
    let proxy: any
    const Comp = {
      render() {
        proxy = getCurrentInstance()
        return h('div')
      }
    }

    render(
      h(Comp, null, {
        header: () => 'header'
      }),
      nodeOps.createElement('div')
    )

    expect(proxy.slots.header()).toMatchObject([normalizeVNode('header')])
  })

  test('initSlots: instance.slots should be set correctly (when vnode.shapeFlag is not SLOTS_CHILDREN)', () => {
    let proxy: any
    const Comp = {
      render() {
        proxy = getCurrentInstance()
        return h('div')
      }
    }

    render(h(Comp, null, [h('span')]), nodeOps.createElement('div'))

    expect(
      '[Vue warn]: Non-function value encountered for default slot. Prefer function slots for better performance.'
    ).toHaveBeenWarned()

    expect(proxy.slots.default()).toMatchObject([normalizeVNode(h('span'))])
  })

  test('should respect $stable flag', async () => {
    const flag1 = ref(1)
    const flag2 = ref(2)
    const spy = jest.fn()

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
              $stable: true
            }
          )
        ]
      }
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
})
