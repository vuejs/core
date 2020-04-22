import { toHandlers } from '../../src/helpers/toHandlers'
import { mockWarn } from '@vue/shared'

describe('toHandlers', () => {
  mockWarn()

  it('should not accept non-objects', () => {
    toHandlers(null as any)
    toHandlers(undefined as any)

    expect(
      'v-on with no argument expects an object value.'
    ).toHaveBeenWarnedTimes(2)
  })

  it('should properly change object keys', () => {
    const input = () => {}
    const change = () => {}

    expect(toHandlers({ input, change })).toStrictEqual({
      oninput: input,
      onchange: change
    })
  })
})
