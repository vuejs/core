// NOTE: This test is implemented based on the case of `runtime-core/__test__/componentSlots.spec.ts`.

import {
  createComponent,
  createVaporApp,
  defineComponent,
  getCurrentInstance,
  nextTick,
  ref,
  template,
} from '../src'
import { makeRender } from './_utils'

const define = makeRender<any>()
function renderWithSlots(slots: any): any {
  let instance: any
  const Comp = defineComponent({
    render() {
      const t0 = template('<div></div>')
      const n0 = t0()
      instance = getCurrentInstance()
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
    let instance: any
    const Comp = defineComponent({
      render() {
        const t0 = template('<div></div>')
        const n0 = t0()
        instance = getCurrentInstance()
        return n0
      },
    })

    const { render } = define({
      render() {
        return createComponent(Comp, {}, { header: () => template('header')() })
      },
    })

    render()

    expect(instance.slots.header()).toMatchObject(
      document.createTextNode('header'),
    )
  })

  // NOTE: slot normalization is not supported
  test.todo(
    'initSlots: should normalize object slots (when value is null, string, array)',
    () => {},
  )
  test.todo(
    'initSlots: should normalize object slots (when value is function)',
    () => {},
  )

  // runtime-core's "initSlots: instance.slots should be set correctly (when vnode.shapeFlag is not SLOTS_CHILDREN)"
  test('initSlots: instance.slots should be set correctly', () => {
    const { slots } = renderWithSlots({
      default: () => template('<span></span>')(),
    })

    // expect(
    //   '[Vue warn]: Non-function value encountered for default slot. Prefer function slots for better performance.',
    // ).toHaveBeenWarned()

    expect(slots.default()).toMatchObject(document.createElement('span'))
  })

  test('updateSlots: instance.slots should be updated correctly', async () => {
    const flag1 = ref(true)

    let instance: any
    const Child = () => {
      instance = getCurrentInstance()
      return template('child')()
    }

    const { render } = define({
      render() {
        return createComponent(Child, {}, { _: 2 as any }, () => [
          flag1.value
            ? { name: 'one', fn: () => template('<span></span>')() }
            : { name: 'two', fn: () => template('<div></div>')() },
        ])
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

  // NOTE: it is not supported
  // test('updateSlots: instance.slots should be updated correctly (when slotType is null)', () => {})

  // runtime-core's "updateSlots: instance.slots should be update correctly (when vnode.shapeFlag is not SLOTS_CHILDREN)"
  test('updateSlots: instance.slots should be update correctly', async () => {
    const flag1 = ref(true)

    let instance: any
    const Child = () => {
      instance = getCurrentInstance()
      return template('child')()
    }

    const { render } = define({
      setup() {
        return createComponent(Child, {}, {}, () => [
          flag1.value
            ? [{ name: 'header', fn: () => template('header')() }]
            : [{ name: 'footer', fn: () => template('footer')() }],
        ])
      },
    })
    render()

    expect(instance.slots).toHaveProperty('header')
    flag1.value = false
    await nextTick()

    // expect(
    //   '[Vue warn]: Non-function value encountered for default slot. Prefer function slots for better performance.',
    // ).toHaveBeenWarned()

    expect(instance.slots).toHaveProperty('footer')
  })

  test('the current instance should be kept in the slot', async () => {
    let instanceInDefaultSlot: any
    let instanceInVForSlot: any
    let instanceInVIfSlot: any

    const Comp = defineComponent({
      render() {
        const instance = getCurrentInstance()
        instance!.slots.default!()
        instance!.slots.inVFor!()
        instance!.slots.inVIf!()
        return template('<div></div>')()
      },
    })

    const { instance } = define({
      render() {
        return createComponent(
          Comp,
          {},
          {
            default: () => {
              instanceInDefaultSlot = getCurrentInstance()
              return template('content')()
            },
          },
          () => [
            [
              {
                name: 'inVFor',
                fn: () => {
                  instanceInVForSlot = getCurrentInstance()
                  return template('content')()
                },
              },
            ],
            {
              name: 'inVIf',
              key: '1',
              fn: () => {
                instanceInVIfSlot = getCurrentInstance()
                return template('content')()
              },
            },
          ],
        )
      },
    }).render()

    expect(instanceInDefaultSlot).toBe(instance)
    expect(instanceInVForSlot).toBe(instance)
    expect(instanceInVIfSlot).toBe(instance)
  })

  test.todo('should respect $stable flag', async () => {
    // TODO: $stable flag?
  })

  test.todo('should not warn when mounting another app in setup', () => {
    // TODO: warning
    const Comp = defineComponent({
      render() {
        const i = getCurrentInstance()
        return i!.slots.default!()
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
      },
      render() {
        return null!
      },
    }
    createVaporApp(App).mount(document.createElement('div'))
    expect(
      'Slot "default" invoked outside of the render function',
    ).not.toHaveBeenWarned()
  })
})
