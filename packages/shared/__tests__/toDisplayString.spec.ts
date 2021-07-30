import { computed, ref, markRaw } from '@vue/reactivity'
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
  })

  test('markRaw ref', () => {
    let rawValue = 5

    let refRaw = markRaw(ref(rawValue))

    // spy on value getter
    let spyRefRawValue = jest.spyOn(refRaw, 'value', 'get')

    let refRawDisplayString = toDisplayString(refRaw)
    expect(refRawDisplayString).toBe(JSON.stringify(refRaw, null, 2))
    expect(refRawDisplayString).not.toBe('5')

    // .value should not be accessed as to not trigger reactivity
    expect(spyRefRawValue).not.toHaveBeenCalled()
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
