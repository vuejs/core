import {
  normalizeClass,
  normalizeProps,
  normalizeStyle,
  parseStringStyle,
  stringifyStyle,
} from '../src'

describe('normalizeClass', () => {
  test('handles undefined correctly', () => {
    expect(normalizeClass(undefined)).toEqual('')
  })

  test('handles string correctly', () => {
    expect(normalizeClass('foo')).toEqual('foo')
  })

  test('handles array correctly', () => {
    expect(normalizeClass(['foo', undefined, true, false, 'bar'])).toEqual(
      'foo bar',
    )
  })

  test('handles string containing spaces correctly', () => {
    expect(normalizeClass('foo1 ')).toEqual('foo1')
    expect(normalizeClass(['foo ', ' baz '])).toEqual('foo baz')
  })

  test('handles empty array correctly', () => {
    expect(normalizeClass([])).toEqual('')
  })

  test('handles nested array correctly', () => {
    expect(normalizeClass(['foo', ['bar'], [['baz']]])).toEqual('foo bar baz')
  })

  test('handles object correctly', () => {
    expect(normalizeClass({ foo: true, bar: false, baz: true })).toEqual(
      'foo baz',
    )
  })

  test('handles empty object correctly', () => {
    expect(normalizeClass({})).toEqual('')
  })

  test('handles arrays and objects correctly', () => {
    expect(
      normalizeClass(['foo', ['bar'], { baz: true }, [{ qux: true }]]),
    ).toEqual('foo bar baz qux')
  })

  test('handles array of objects with falsy values', () => {
    expect(
      normalizeClass([
        { foo: false },
        { bar: 0 },
        { baz: -0 },
        { qux: '' },
        { quux: null },
        { corge: undefined },
        { grault: NaN },
      ]),
    ).toEqual('')
  })

  test('handles array of objects with truthy values', () => {
    expect(
      normalizeClass([
        { foo: true },
        { bar: 'not-empty' },
        { baz: 1 },
        { qux: {} },
        { quux: [] },
      ]),
    ).toEqual('foo bar baz qux quux')
  })

  // #6777
  test('parse multi-line inline style', () => {
    expect(
      parseStringStyle(`border: 1px solid transparent;
    background: linear-gradient(white, white) padding-box,
      repeating-linear-gradient(
        -45deg,
        #ccc 0,
        #ccc 0.5em,
        white 0,
        white 0.75em
      );`),
    ).toMatchInlineSnapshot(`
      {
        "background": "linear-gradient(white, white) padding-box,
            repeating-linear-gradient(
              -45deg,
              #ccc 0,
              #ccc 0.5em,
              white 0,
              white 0.75em
            )",
        "border": "1px solid transparent",
      }
    `)
  })
})

describe('normalizeStyle', () => {
  test('handles string correctly', () => {
    expect(normalizeStyle('foo')).toEqual('foo')
  })

  test('handles array correctly', () => {
    const style: any = normalizeStyle([
      `border: 1px solid transparent;
    background: linear-gradient(white, white) padding-box,
      repeating-linear-gradient(
        -45deg,
        #ccc 0,
        #ccc 0.5em,
        white 0,
        white 0.75em
      );`,
    ])

    expect(style.border).toEqual('1px solid transparent')

    expect(style.background).toEqual(`linear-gradient(white, white) padding-box,
      repeating-linear-gradient(
        -45deg,
        #ccc 0,
        #ccc 0.5em,
        white 0,
        white 0.75em
      )`)
  })

  test('handles object correctly', () => {
    const styleObj = {
      border: '1px solid transparent',
      background: `linear-gradient(white, white) padding-box,
      repeating-linear-gradient(
        -45deg,
        #ccc 0,
        #ccc 0.5em,
        white 0,
        white 0.75em
      )`,
    }
    const style: any = normalizeStyle(styleObj)
    expect(style.border).toEqual(styleObj.border)
    expect(style.background).toEqual(styleObj.background)
  })
})

describe('stringifyStyle', () => {
  test('should return empty string for undefined', () => {
    expect(stringifyStyle(undefined)).toBe('')
    expect(stringifyStyle('')).toBe('')
    expect(stringifyStyle('color: blue;')).toBe('color: blue;')
  })

  test('should return valid CSS string for normalized style object', () => {
    const style = {
      color: 'blue',
      fontSize: '14px',
      backgroundColor: 'white',
      opacity: 0.8,
      margin: 0,
      '--custom-color': 'red',
    }

    expect(stringifyStyle(style)).toBe(
      'color:blue;font-size:14px;background-color:white;opacity:0.8;margin:0;--custom-color:red;',
    )
  })

  test('should ignore non-string or non-number values in style object', () => {
    const style: any = {
      color: 'blue',
      fontSize: '14px',
      lineHeight: true,
      padding: null,
      margin: undefined,
    }

    const expected = 'color:blue;font-size:14px;'
    expect(stringifyStyle(style)).toBe(expected)
  })
})

describe('normalizeProps', () => {
  test('should return null when props is null', () => {
    const props = null
    const result = normalizeProps(props)
    expect(result).toBeNull()
  })

  test('should normalize class prop when it is an array', () => {
    const props = {
      class: ['class1', 'class2'],
    }
    const result = normalizeProps(props)
    expect(result).toEqual({
      class: 'class1 class2',
    })
  })

  test('should normalize class prop when it is an object', () => {
    const props = {
      class: {
        class1: true,
        class2: false,
        class3: true,
      },
    }
    const result = normalizeProps(props)
    expect(result).toEqual({
      class: 'class1 class3',
    })
  })

  test('should normalize style prop', () => {
    const props = {
      style: ['color: blue', 'font-size: 14px'],
    }
    const result = normalizeProps(props)
    expect(result).toEqual({
      style: {
        color: 'blue',
        'font-size': '14px',
      },
    })
  })
})
