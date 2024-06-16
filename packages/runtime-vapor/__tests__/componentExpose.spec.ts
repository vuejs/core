import { describe, expect } from 'vitest'
import { makeRender } from './_utils'
import { type Ref, ref } from '@vue/reactivity'

const define = makeRender()

describe('component expose', () => {
  test('should work', async () => {
    const expxosedObj = { foo: 1 }
    const { render } = define({
      setup(_, { expose }) {
        expose(expxosedObj)
      },
    })
    const { instance } = render()
    expect(instance?.exposed).toEqual(expxosedObj)
  })

  test('should warn when called multiple times', async () => {
    const { render } = define({
      setup(_, { expose }) {
        expose()
        expose()
      },
    })
    render()
    expect(
      'expose() should be called only once per setup().',
    ).toHaveBeenWarned()
  })

  test('should warn when passed non-object', async () => {
    const exposedRef = ref<number[] | Ref>([1, 2, 3])
    const { render } = define({
      setup(_, { expose }) {
        expose(exposedRef.value)
      },
    })
    render()
    expect(
      'expose() should be passed a plain object, received array.',
    ).toHaveBeenWarned()
    exposedRef.value = ref(1)
    render()
    expect(
      'expose() should be passed a plain object, received ref.',
    ).toHaveBeenWarned()
  })
})
