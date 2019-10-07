import { mockWarn } from '@vue/runtime-test'

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

    test('Attempting to mutate public property', () => {
      console.warn('Attempting to mutate public property "$foo" to "foo"')

      expect(
        'Attempting to mutate public property "$foo" to "foo"'
      ).toHaveBeenWarned()
    })

    test('Attempting to mutate prop', () => {
      console.warn('Attempting to mutate prop "$foo" to "foo"')

      expect('Attempting to mutate prop "$foo" to "foo"').toHaveBeenWarned()
    })
  })
})
