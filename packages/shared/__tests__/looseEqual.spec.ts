import { looseEqual } from '../src'

test('looseEqual should compare Date object', () => {
  const date1 = new Date(1592297844875)
  const date2 = new Date(1592297844875)
  expect(looseEqual(date1, date2)).toBe(true)
})

test('looseEqual should compare deep object', () => {
  const obj1 = { a: { b: 123 } }
  const obj2 = { a: { b: 123 } }
  expect(looseEqual(obj1, obj2)).toBe(true)
})
