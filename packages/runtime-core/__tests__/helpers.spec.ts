import { toHandlers } from '@vue/runtime-core'
import { mockWarn } from '@vue/runtime-test'

describe('toHandlers', () => {
  mockWarn()

  it('should not accept non-objects', () => {
    toHandlers((null as unknown) as any)
    toHandlers((undefined as unknown) as any)

    // TODO: toHaveBeenWarnedTimes here will take any number and pass. That doesn't seem correct.
    expect('v-on with no argument expects an object value.').toHaveBeenWarned()
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
