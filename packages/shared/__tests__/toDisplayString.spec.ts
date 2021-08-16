import { computed, ref } from '@vue/reactivity'
import { toDisplayString } from '../src'

describe('toDisplayString', () => {
  test('nullish values', () => {
    expect(toDisplayString(null)).toBe('')
    expect(toDisplayString(undefined)).toBe('')
  })

  test('primitive values', () => {
    expect(toDisplayString(1)).toBe('1')
    expect(toDisplayString(true)).toBe('true')
    expect(toDisplayString(false)).toBe('false')
    expect(toDisplayString('hello')).toBe('hello')
  })

  test('Object and Arrays', () => {
    const obj = { foo: 123 }
    expect(toDisplayString(obj)).toBe(JSON.stringify(obj, null, 2))
    const arr = [obj]
    expect(toDisplayString(arr)).toBe(JSON.stringify(arr, null, 2))

    const objWithToStringOverride = {
      foo: 555,
      toString() {
        return 'override'
      }
    }
    expect(toDisplayString(objWithToStringOverride)).toBe('override')

    const objWithNonInvokeableToString = {
      foo: 555,
      toString: null
    }
    expect(toDisplayString(objWithNonInvokeableToString)).toBe(
      `{
  "foo": 555,
  "toString": null
}`
    )

    // object created from null does not have .toString in its prototype
    const nullObjectWithoutToString = Object.create(null)
    nullObjectWithoutToString.bar = 1
    expect(toDisplayString(nullObjectWithoutToString)).toBe(
      `{
  "bar": 1
}`
    )

    // array toString override is ignored
    const arrWithToStringOverride = [1, 2, 3]
    arrWithToStringOverride.toString = () =>
      'override for array is not supported'
    expect(toDisplayString(arrWithToStringOverride)).toBe(
      `[
  1,
  2,
  3
]`
    )
  })

  test('refs', () => {
    const n = ref(1)
    const np = computed(() => n.value + 1)
    expect(
      toDisplayString({
        n,
        np
      })
    ).toBe(JSON.stringify({ n: 1, np: 2 }, null, 2))
  })

  test('objects with custom toString', () => {
    class TestClass {
      toString() {
        return 'foo'
      }
    }
    const instance = new TestClass()
    expect(toDisplayString(instance)).toBe('foo')
    const obj = { toString: () => 'bar' }
    expect(toDisplayString(obj)).toBe('bar')
  })

  test('native objects', () => {
    const div = document.createElement('div')
    expect(toDisplayString(div)).toBe('[object HTMLDivElement]')
    expect(toDisplayString({ div })).toMatchInlineSnapshot(`
      "{
        \\"div\\": \\"[object HTMLDivElement]\\"
      }"
    `)
  })

  test('Map and Set', () => {
    const m = new Map<any, any>([
      [1, 'foo'],
      [{ baz: 1 }, { foo: 'bar', qux: 2 }]
    ])
    const s = new Set<any>([1, { foo: 'bar' }, m])

    expect(toDisplayString(m)).toMatchInlineSnapshot(`
      "{
        \\"Map(2)\\": {
          \\"1 =>\\": \\"foo\\",
          \\"[object Object] =>\\": {
            \\"foo\\": \\"bar\\",
            \\"qux\\": 2
          }
        }
      }"
    `)
    expect(toDisplayString(s)).toMatchInlineSnapshot(`
      "{
        \\"Set(3)\\": [
          1,
          {
            \\"foo\\": \\"bar\\"
          },
          {
            \\"Map(2)\\": {
              \\"1 =>\\": \\"foo\\",
              \\"[object Object] =>\\": {
                \\"foo\\": \\"bar\\",
                \\"qux\\": 2
              }
            }
          }
        ]
      }"
    `)

    expect(
      toDisplayString({
        m,
        s
      })
    ).toMatchInlineSnapshot(`
      "{
        \\"m\\": {
          \\"Map(2)\\": {
            \\"1 =>\\": \\"foo\\",
            \\"[object Object] =>\\": {
              \\"foo\\": \\"bar\\",
              \\"qux\\": 2
            }
          }
        },
        \\"s\\": {
          \\"Set(3)\\": [
            1,
            {
              \\"foo\\": \\"bar\\"
            },
            {
              \\"Map(2)\\": {
                \\"1 =>\\": \\"foo\\",
                \\"[object Object] =>\\": {
                  \\"foo\\": \\"bar\\",
                  \\"qux\\": 2
                }
              }
            }
          ]
        }
      }"
    `)
  })
})
