import { ref, shallowRef } from '@vue/reactivity'
import { createComponent } from '../src/apiCreateComponent'
import { setRef } from '../src/dom/templateRef'
import { makeRender } from './_utils'
import {
  type ComponentInternalInstance,
  getCurrentInstance,
} from '../src/component'

const define = makeRender()
describe('api: expose', () => {
  test('via setup context', () => {
    const { component: Child } = define({
      setup(_, { expose }) {
        expose({
          foo: 1,
          bar: ref(2),
        })
        return {
          bar: ref(3),
          baz: ref(4),
        }
      },
    })
    const childRef = ref()
    const { render } = define({
      render: () => {
        const n0 = createComponent(Child)
        setRef(n0, childRef)
        return n0
      },
    })

    render()
    expect(childRef.value).toBeTruthy()
    expect(childRef.value.foo).toBe(1)
    expect(childRef.value.bar).toBe(2)
    expect(childRef.value.baz).toBeUndefined()
  })

  test('via setup context (expose empty)', () => {
    let childInstance: ComponentInternalInstance | null = null
    const { component: Child } = define({
      setup(_) {
        childInstance = getCurrentInstance()
      },
    })
    const childRef = shallowRef()
    const { render } = define({
      render: () => {
        const n0 = createComponent(Child)
        setRef(n0, childRef)
        return n0
      },
    })

    render()
    expect(childInstance!.exposed).toBeUndefined()
    expect(childRef.value).toBe(childInstance!)
  })

  test('warning for ref', () => {
    const { render } = define({
      setup(_, { expose }) {
        expose(ref(1))
      },
    })
    render()
    expect(
      'expose() should be passed a plain object, received ref',
    ).toHaveBeenWarned()
  })

  test('warning for array', () => {
    const { render } = define({
      setup(_, { expose }) {
        expose(['focus'])
      },
    })
    render()
    expect(
      'expose() should be passed a plain object, received array',
    ).toHaveBeenWarned()
  })

  test('warning for function', () => {
    const { render } = define({
      setup(_, { expose }) {
        expose(() => null)
      },
    })
    render()
    expect(
      'expose() should be passed a plain object, received function',
    ).toHaveBeenWarned()
  })
})
