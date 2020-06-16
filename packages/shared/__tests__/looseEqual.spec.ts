import { looseEqual } from '../src'

test('looseEqual should compare Date object', () => {
  const date1 = new Date(1592297844875)
  const date2 = new Date(1592297844875)

  expect(looseEqual(date1, date2)).toBe(true)
})
