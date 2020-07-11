import { looseEqual } from '../src'

test('looseEqual', () => {
  const tmp1 = 1594464815100
  const tmp2 = 1594464815239
  const date1 = new Date(tmp1)
  const date2 = new Date(tmp1)
  const date3 = new Date(tmp2)
  expect(looseEqual(date1, date2)).toBe(true)
  expect(looseEqual(date1, date3)).toBe(false)
  const arr1 = [[2, 78, 'a', ['a', 'b', 11]], 9, 4, 1]
  const arr2 = [[2, 78, 'a', ['a', 'b', 12]], 9, 4, 1]
  const arr3 = [[2, 78, 'a', ['a', 'b', 12]], 9, 4, 1]
  expect(looseEqual(arr1, arr2)).toBe(false)
  expect(looseEqual(arr2, arr3)).toBe(true)
})
