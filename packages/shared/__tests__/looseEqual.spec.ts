import { looseEqual } from '../src'

test('compares NaN correctly', () => {
    expect(looseEqual(NaN, NaN)).toBe(true)
    expect(looseEqual(NaN, 'NaN')).toBe(false)
    expect(looseEqual('NaN', NaN)).toBe(false)
})
