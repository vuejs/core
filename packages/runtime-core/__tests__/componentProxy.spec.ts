import { createApp, nodeOps, mockWarn } from '@vue/runtime-test'

describe('component proxy', () => {
  /**
   * These tests should tests the warnings for PublicInstanceProxyHandlers in componentProxy
   * {@link @vue/runtime-core/src/componentProxy}
   *
   * The function setupStatefulComponent is the location where PublicInstanceProxyHandlers is being used.
   * {@link @vue/runtime-core/src/createRenderer}
   *
   * Currently I haven't found a way to create a component that uses PublicInstanceProxyHandlers
   */
  describe('warnings', () => {
    mockWarn()
    let app: any, appProps: any

    beforeEach(() => {
      const component = {
        render() {}
      }
      const root = nodeOps.createElement('div')
      app = createApp().mount(component, root, appProps)
    })

    test('Attempting to mutate public property', () => {
      try {
        // @ts-ignore
        app.$props = null
      } catch {
        expect(
          'Attempting to mutate public property "$props". ' +
            'Properties starting with $ are reserved and readonly.'
        ).toHaveBeenWarned()
      }
    })

    test('Attempting to mutate prop', () => {
      appProps = { foo: 'foo' }
      try {
        // @ts-ignore
        app.foo = null
      } catch {
        expect(
          'Attempting to mutate prop "foo". Props are readonly.'
        ).toHaveBeenWarned()
      }
    })
  })
})
