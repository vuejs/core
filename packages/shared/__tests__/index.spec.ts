import { toDisplayString } from '../src'

test('toDisplayString', () => {
  expect(toDisplayString(null)).toBe(``)
  expect(toDisplayString([1, 2, 3])).toBe(`[
  1,
  2,
  3
]`)
  expect(
    toDisplayString({
      foo: 'bar',
      baz: 1
    })
  ).toBe(`{
  "foo": "bar",
  "baz": 1
}`)
  expect(toDisplayString(new Map<any, any>([['foo', 'bar'], ['baz', 1]])))
    .toBe(`{
  "dataType": "Map",
  "value": [
    [
      "foo",
      "bar"
    ],
    [
      "baz",
      1
    ]
  ]
}`)
  expect(toDisplayString(new Set<any>([1, 2, 3]))).toBe(`{
  "dataType": "Set",
  "value": [
    1,
    2,
    3
  ]
}`)
})
