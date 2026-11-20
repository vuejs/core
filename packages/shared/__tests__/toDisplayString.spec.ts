/**
 * @vitest-environment jsdom
 */
import { computed, ref } from '@vue/reactivity'
import { toDisplayString } from '../src'

describe('toDisplayString', () => {
  test('nullish values', () => {
    expect(toDisplayString(null)).toBe('')
    expect(toDisplayString(undefined)).toBe('')
  })

  test('primitive values', () => {
    expect(toDisplayString(0)).toBe('0')
    expect(toDisplayString(1)).toBe('1')
    expect(toDisplayString(NaN)).toBe('NaN')
    expect(toDisplayString(true)).toBe('true')
    expect(toDisplayString(false)).toBe('false')
    expect(toDisplayString('hello')).toBe('hello')
  })

  test('primitive values in refs', () => {
    expect(toDisplayString(ref(0))).toBe('0')
    expect(toDisplayString(ref(1))).toBe('1')
    expect(toDisplayString(ref(NaN))).toBe('NaN')
    expect(toDisplayString(ref(true))).toBe('true')
    expect(toDisplayString(ref(false))).toBe('false')
    expect(toDisplayString(ref('hello'))).toBe('hello')
  })

  test.each([
    ['array', (value: bigint) => [value], '[\n  "9007199254740993"\n]'],
    [
      'object',
      (value: bigint) => ({ value }),
      '{\n  "value": "9007199254740993"\n}',
    ],
    [
      'nested ref',
      (value: bigint) => ({ value: ref(value) }),
      '{\n  "value": "9007199254740993"\n}',
    ],
    [
      'map',
      (value: bigint) => new Map([['value', value]]),
      '{\n  "Map(1)": {\n    "value =>": "9007199254740993"\n  }\n}',
    ],
    [
      'set',
      (value: bigint) => new Set([value]),
      '{\n  "Set(1)": [\n    "9007199254740993"\n  ]\n}',
    ],
  ])('bigint values nested in %s', (_, wrap, expected) => {
    const value = BigInt('9007199254740993')
    expect(toDisplayString(value)).toBe('9007199254740993')
    expect(toDisplayString(ref(value))).toBe('9007199254740993')
    expect(toDisplayString(wrap(value))).toBe(expected)
  })

  test('bigint display preserves precision and existing serialization hooks', () => {
    const positive = BigInt('123456789012345678901234567890')
    const negative = -positive
    expect(toDisplayString([BigInt(0), negative])).toBe(
      '[\n  "0",\n  "-123456789012345678901234567890"\n]',
    )
    expect(toDisplayString({ toJSON: () => positive })).toBe(
      '"123456789012345678901234567890"',
    )
    expect(toDisplayString({ value: positive, toString: () => 'custom' })).toBe(
      'custom',
    )
    // Do not change the native BigInt serialization contract globally.
    expect(() => JSON.stringify({ value: positive })).toThrow(TypeError)
  })

  test('symbol values', () => {
    expect(toDisplayString(Symbol('hello'))).toBe('Symbol(hello)')
    expect(toDisplayString(ref(Symbol('hello')))).toBe('Symbol(hello)')
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
      },
    }
    expect(toDisplayString(objWithToStringOverride)).toBe('override')

    const objWithNonInvokableToString = {
      foo: 555,
      toString: null,
    }
    expect(toDisplayString(objWithNonInvokableToString)).toBe(
      `{
  "foo": 555,
  "toString": null
}`,
    )

    // object created from null does not have .toString in its prototype
    const nullObjectWithoutToString = Object.create(null)
    nullObjectWithoutToString.bar = 1
    expect(toDisplayString(nullObjectWithoutToString)).toBe(
      `{
  "bar": 1
}`,
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
]`,
    )
  })

  test('refs', () => {
    const n = ref(1)
    const np = computed(() => n.value + 1)
    expect(
      toDisplayString({
        n,
        np,
      }),
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
    expect(toDisplayString(div)).toMatch('[object HTMLDivElement]')
    expect(toDisplayString({ div })).toMatchInlineSnapshot(`
      "{
        "div": "[object HTMLDivElement]"
      }"
    `)
  })

  test('Map and Set', () => {
    const m = new Map<any, any>([
      [1, 'foo'],
      [{ baz: 1 }, { foo: 'bar', qux: 2 }],
    ])
    const s = new Set<any>([1, { foo: 'bar' }, m])

    expect(toDisplayString(m)).toMatchInlineSnapshot(`
      "{
        "Map(2)": {
          "1 =>": "foo",
          "[object Object] =>": {
            "foo": "bar",
            "qux": 2
          }
        }
      }"
    `)
    expect(toDisplayString(s)).toMatchInlineSnapshot(`
      "{
        "Set(3)": [
          1,
          {
            "foo": "bar"
          },
          {
            "Map(2)": {
              "1 =>": "foo",
              "[object Object] =>": {
                "foo": "bar",
                "qux": 2
              }
            }
          }
        ]
      }"
    `)

    expect(
      toDisplayString({
        m,
        s,
      }),
    ).toMatchInlineSnapshot(`
      "{
        "m": {
          "Map(2)": {
            "1 =>": "foo",
            "[object Object] =>": {
              "foo": "bar",
              "qux": 2
            }
          }
        },
        "s": {
          "Set(3)": [
            1,
            {
              "foo": "bar"
            },
            {
              "Map(2)": {
                "1 =>": "foo",
                "[object Object] =>": {
                  "foo": "bar",
                  "qux": 2
                }
              }
            }
          ]
        }
      }"
    `)
  })

  //#9727
  test('Map with Symbol keys', () => {
    const m = new Map<any, any>([
      [Symbol(), 'foo'],
      [Symbol(), 'bar'],
      [Symbol('baz'), 'baz'],
    ])
    expect(toDisplayString(m)).toMatchInlineSnapshot(`
      "{
        "Map(3)": {
          "Symbol(0) =>": "foo",
          "Symbol(1) =>": "bar",
          "Symbol(baz) =>": "baz"
        }
      }"
    `)
    // confirming the symbol renders Symbol(foo)
    expect(toDisplayString(new Map([[Symbol('foo'), 'foo']]))).toContain(
      String(Symbol('foo')),
    )
  })

  test('Set with Symbol values', () => {
    const s = new Set([Symbol('foo'), Symbol('bar'), Symbol()])
    expect(toDisplayString(s)).toMatchInlineSnapshot(`
      "{
        "Set(3)": [
          "Symbol(foo)",
          "Symbol(bar)",
          "Symbol()"
        ]
      }"
    `)
  })

  test('Object with Symbol values', () => {
    expect(toDisplayString({ foo: Symbol('x'), bar: Symbol() }))
      .toMatchInlineSnapshot(`
      "{
        "foo": "Symbol(x)",
        "bar": "Symbol()"
      }"
    `)
  })
})
