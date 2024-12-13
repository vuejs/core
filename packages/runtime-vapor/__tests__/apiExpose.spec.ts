import { ref, shallowRef } from '@vue/reactivity'
import { type VaporComponentInstance, createComponent } from '../src/component'
import { setRef } from '../src/apiTemplateRef'
import { makeRender } from './_utils'
import { currentInstance } from '@vue/runtime-dom'
import { defineVaporComponent } from '../src/apiDefineComponent'

const define = makeRender()

describe('api: expose', () => {
  test('via setup context + template ref', () => {
    let i: any
    const Child = defineVaporComponent({
      setup(_, { expose }) {
        expose({
          foo: 1,
          bar: ref(2),
        })
        return []
      },
    })
    const childRef = ref()
    define({
      setup: () => {
        const n0 = (i = createComponent(Child))
        setRef(currentInstance as VaporComponentInstance, n0, childRef)
        return n0
      },
    }).render()

    expect(childRef.value).toBe(i.exposeProxy)
    expect(childRef.value.foo).toBe(1)
    expect(childRef.value.bar).toBe(2)
    expect(childRef.value.baz).toBeUndefined()
  })

  test('via setup context + template ref (expose empty)', () => {
    let childInstance: VaporComponentInstance | null = null
    const Child = defineVaporComponent({
      setup(_) {
        childInstance = currentInstance as VaporComponentInstance
        return []
      },
    })
    const childRef = shallowRef()
    define({
      setup: () => {
        const n0 = createComponent(Child)
        setRef(currentInstance as VaporComponentInstance, n0, childRef)
        return n0
      },
    }).render()

    expect(childInstance!.exposed).toBeNull()
    expect(childRef.value).toBe(childInstance!)
  })

  test('with mount', () => {
    const { app, host } = define({
      setup(_, { expose }) {
        expose({
          foo: 1,
        })
        return []
      },
    }).create()
    const exposed = app.mount(host) as any
    expect(exposed.foo).toBe(1)
    expect(exposed.bar).toBe(undefined)
  })

  test('warning for ref', () => {
    define({
      setup(_, { expose }) {
        expose(ref(1))
        return []
      },
    }).render()

    expect(
      'expose() should be passed a plain object, received ref',
    ).toHaveBeenWarned()
  })

  test('warning for array', () => {
    define({
      setup(_, { expose }) {
        expose(['focus'])
        return []
      },
    }).render()

    expect(
      'expose() should be passed a plain object, received array',
    ).toHaveBeenWarned()
  })

  test('warning for function', () => {
    define({
      setup(_, { expose }) {
        expose(() => null)
        return []
      },
    }).render()

    expect(
      'expose() should be passed a plain object, received function',
    ).toHaveBeenWarned()
  })
})
