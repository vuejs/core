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
      console.warn(
        'Attempting to mutate public property "$foo".' +
          'Properties starting with $ are reserved and readonly.'
      )

      expect(
        'Attempting to mutate public property "$foo".' +
          'Properties starting with $ are reserved and readonly.'
      ).toHaveBeenWarned()
    })

    test('Attempting to mutate prop', () => {
      console.warn(`Attempting to mutate prop "foo". Props are readonly.`)

      expect(
        'Attempting to mutate prop "foo". Props are readonly.'
      ).toHaveBeenWarned()
    })
  })
})
