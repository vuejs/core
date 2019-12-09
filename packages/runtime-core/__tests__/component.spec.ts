import { h, ref, render, nodeOps, nextTick } from '@vue/runtime-test'

describe('renderer: component', () => {
  test.todo('should work')

  test.todo('shouldUpdateComponent')

  test.todo('componentProxy')

  test.todo('componentProps')

  describe('slots', () => {
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

      // parent re-render, props didn't change, slots are stasble
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
})
