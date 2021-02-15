import { nodeOps } from '../src/nodeOps'

describe('nodeOps', () => {
  test('the _value property should be cloned', () => {
    const el = nodeOps.createElement('input') as HTMLDivElement & {
      _value: any
    }
    el._value = 1
    const cloned = nodeOps.cloneNode!(el) as HTMLDivElement & { _value: any }
    expect(cloned._value).toBe(1)
  })
})
