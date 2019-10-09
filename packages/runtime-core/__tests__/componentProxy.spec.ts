import { createApp, nodeOps, mockWarn } from '@vue/runtime-test'

const createTestInstance = (props?: any) => {
  const component = {
    render() {}
  }
  const root = nodeOps.createElement('div')
  return createApp().mount(component, root, props)
}

describe('component proxy', () => {
  describe('warnings', () => {
    mockWarn()

    test('Attempting to mutate public property', () => {
      const app = createTestInstance()

      try {
        app.$props = { foo: 'bar' }
      } catch {
        expect(
          'Attempting to mutate public property "$props". ' +
            'Properties starting with $ are reserved and readonly.'
        ).toHaveBeenWarned()
      }
    })

    test('Attempting to mutate prop', () => {
      const app = createTestInstance({ foo: 'foo' })

      try {
        app.foo = 'bar'
      } catch {
        expect(
          'Attempting to mutate prop "foo". Props are readonly.'
        ).toHaveBeenWarned()
      }
    })
  })
})
