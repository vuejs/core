import { generateMatchSelector, parseMatchPattern } from '../src/patterns'

function select(
  patterns: string[],
  subject: unknown,
  values: Record<string, unknown> = {},
) {
  const expression = generateMatchSelector(
    patterns.map(parseMatchPattern),
    'subject',
    '__test',
  )
  return new Function(
    'subject',
    ...Object.keys(values),
    `return ${expression}`,
  )(subject, ...Object.values(values))
}

describe('RFC 823 pattern grammar', () => {
  test.each([
    "'ok'",
    '42',
    '-42',
    '0xff',
    '1.5e2',
    '123n',
    'true',
    'null',
    'undefined',
    'NaN',
    'Status.Active',
    "Status['active']",
    'fallback',
    '_',
    'const value',
    "{ status: 'ok', const data }",
    '{ nested: { const value }, ...const other }',
    '[]',
    '[const head, ...const tail]',
    '[...]',
    '{ ... }',
    "('idle' | 'pending') as pending",
    '([1] | [2]) as pair',
    '{ "a-b": _, 0: const zero }',
    'const 日本語',
    '{ const value } if (value && fn("if ("))',
  ])('accepts %s', pattern => {
    const arm = parseMatchPattern(pattern)
    expect(arm.pattern.end).toBeGreaterThan(arm.pattern.start)
    expect(
      () =>
        new Function(
          'subject',
          `return ${generateMatchSelector([arm], 'subject', '__test')}`,
        ),
    ).not.toThrow()
  })

  test.each([
    '',
    ' ',
    'let value',
    'var value',
    'const for',
    'const',
    'foo()',
    'a + b',
    'new Foo',
    '{ foo }',
    '{ const x, x: const y }',
    '{ a: const x, b: const x }',
    '[const x, const x]',
    '{ const x, nested: { x: const x } }',
    '{ const x, ...const x }',
    '[const x, ...const x]',
    '{ const x } as x',
    'const x as x',
    '_ as x as y',
    'const x | 1',
    '1 | const x',
    '({ const x }) | {}',
    '[...rest]',
    '[...let rest]',
    '{ ...var rest }',
    '[...const x,]',
    '[..., 1]',
    '{ ..., a: _ }',
    '{ ...const x, ...const y }',
    '[...{ const x }]',
    '...',
    '[,]',
    '[1,,2]',
    '[1',
    '{ x: }',
    '1 || 2',
    '_ if ()',
    '_ if true',
    '_ if (true) extra',
    '0x',
    '1e',
    '1.2n',
    '+1n',
    "'unterminated",
    "'\\uZZZZ'",
    "'\\01'",
    'a?.b',
  ])('rejects %s', pattern => {
    expect(() => parseMatchPattern(pattern)).toThrow(SyntaxError)
  })
})

describe('RFC 823 selection semantics', () => {
  test.each([
    ["'ok'", 'ok', true],
    ["'ok'", 'other', false],
    ['42', '42', false],
    ['-0', 0, true],
    ['NaN', NaN, true],
    ['NaN', 0, false],
    ['null', undefined, false],
    ['undefined', undefined, true],
    ['{ x: _ }', {}, false],
    ['{ x: _ }', { x: undefined }, true],
    ['{}', null, false],
    ['{ x: 1 }', { x: 1, y: 2 }, true],
    ['[]', [], true],
    ['[]', [1], false],
    ['[1]', { 0: 1, length: 1 }, false],
    ['[1]', new Set([1]), false],
    ['[1, ...]', [1], true],
    ['[1, ...]', [1, 2], true],
    ['[1, ...]', [], false],
    ['[1 | 2, true]', [2, true], true],
    ['[1 | 2, true]', [3, true], false],
    ['{ x: { y: 2 } }', { x: null }, false],
  ] as const)('%s against %j selects correctly', (pattern, value, matches) => {
    expect(select([pattern], value)[0]).toBe(matches ? 0 : -1)
  })

  test('evaluates subject once, patterns lazily and guards after bindings', () => {
    const events: string[] = []
    const value = { kind: 'ok', data: 42 }
    const get = () => {
      events.push('subject')
      return value
    }
    const values = {
      get first() {
        events.push('value')
        return 'other'
      },
      get never() {
        throw new Error('unreachable')
      },
    }
    const guard = (data: number) => {
      events.push(`guard:${data}`)
      return false
    }
    const arms = [
      'values.first',
      "{ kind: 'ok', const data } if (guard(data))",
      '{ const data }',
      'values.never',
    ].map(parseMatchPattern)
    const result = new Function(
      'get',
      'values',
      'guard',
      `return ${generateMatchSelector(arms, 'get()', '__test')}`,
    )(get, values, guard)
    expect(result).toEqual([2, 42])
    expect(events).toEqual(['subject', 'value', 'guard:42'])
  })

  test('object rest copies enumerable own strings and symbols, excludes every listed key', () => {
    const symbol = Symbol('metadata')
    const nested = { value: 1 }
    const subject = Object.assign(Object.create({ inherited: 1 }), {
      kind: 'ok',
      value: 2,
      nested,
      [symbol]: 3,
    })
    Object.defineProperty(subject, 'hidden', { value: 4 })
    const result = select(
      ["{ kind: 'ok', value: _, ...const rest } as whole"],
      subject,
    )
    expect(result).toEqual([0, { nested, [symbol]: 3 }, subject])
    expect(result[1]).not.toBe(subject)
    expect(result[1].nested).toBe(nested)
    expect(Object.getPrototypeOf(result[1])).toBe(Object.prototype)
    expect(subject.value).toBe(2)
  })

  test('unbound rest does not read omitted values', () => {
    const subject = {
      kind: 'ok',
      get unread() {
        throw new Error('unexpected read')
      },
    }
    expect(select(["{ kind: 'ok', ... }"], subject)).toEqual([0])
  })

  test('array rest is a fresh ordinary array including a zero-length remainder', () => {
    const subject = Object.freeze([1, 2, 3])
    expect(select(['[const head, ...const tail]'], subject)).toEqual([
      0,
      1,
      [2, 3],
    ])
    expect(select(['[const head, ...const tail]'], [1])).toEqual([0, 1, []])
    expect(select(['[...const tail]'], [])).toEqual([0, []])
    const copy = select(['[...const tail]'], subject)[1]
    expect(copy).not.toBe(subject)
    expect(Object.getPrototypeOf(copy)).toBe(Array.prototype)
  })

  test('rest is available to guards and failed guards continue', () => {
    expect(
      select(
        ['[_, ...const tail] if (tail.length > 1)', '[const first, ...]', '_'],
        [1, 2],
      ),
    ).toEqual([1, 1])
    expect(
      select(['{ x: _, ...const rest } if (rest.y === 2)', '_'], {
        x: 1,
        y: 2,
      }),
    ).toEqual([0, { y: 2 }])
  })

  test('inherited property presence follows the reference in semantics', () => {
    expect(select(['{ x: const value }'], Object.create({ x: 1 }))).toEqual([
      0, 1,
    ])
  })

  test('value patterns use the enclosing scope before branch bindings shadow it', () => {
    expect(
      select(['{ a: value, b: const value }'], { a: 1, b: 2 }, { value: 1 }),
    ).toEqual([0, 2])
  })

  test('copies rest after matching, without re-reading excluded getters', () => {
    const read = vi.fn(() => 'ok')
    const subject = {
      get kind() {
        return read()
      },
      value: 42,
    }
    expect(select(["{ kind: 'ok', ...const rest }"], subject)).toEqual([
      0,
      { value: 42 },
    ])
    expect(read).toHaveBeenCalledTimes(1)
  })

  test('copying a __proto__ key defines an own property without changing the prototype', () => {
    const subject = JSON.parse('{"__proto__":{"changed":true},"value":1}')
    const rest = select(['{ value: _, ...const rest }'], subject)[1]
    expect(Object.getPrototypeOf(rest)).toBe(Object.prototype)
    expect(Object.prototype.hasOwnProperty.call(rest, '__proto__')).toBe(true)
    expect(rest.changed).toBeUndefined()
  })
})
