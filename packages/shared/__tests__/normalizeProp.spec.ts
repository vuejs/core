import {
  normalizeClass,
  parseStringStyle,
  normalizeStyle,
  stringifyStyle,
  normalizeProps
} from '../src'
import { expect } from 'vitest'

describe('normalizeClass', () => {
  test('handles string correctly', () => {
    expect(normalizeClass('foo')).toEqual('foo')
    expect(normalizeClass('foo1 ')).toEqual('foo1')
  })

  test('handles array correctly', () => {
    expect(normalizeClass(['foo ', undefined, true, false, 'bar'])).toEqual(
      'foo bar'
    )
  })

  test('handles object correctly', () => {
    expect(normalizeClass({ foo: true, bar: false, baz: true })).toEqual(
      'foo baz'
    )
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
      );`)
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
      );`
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
      )`
    }
    const style: any = normalizeStyle(styleObj)
    expect(style.border).toEqual(styleObj.border)
    expect(style.background).toEqual(styleObj.background)
  })
})

describe('stringifyStyle', () => {
  it('should return empty string for undefined or string styles', () => {
    expect(stringifyStyle(undefined)).toBe('')
    expect(stringifyStyle('')).toBe('')
    expect(stringifyStyle('color: blue;')).toBe('')
  })

  it('should return valid CSS string for normalized style object', () => {
    const style = {
      color: 'blue',
      fontSize: '14px',
      backgroundColor: 'white',
      opacity: 0.8,
      '--custom-color': 'red'
    }

    expect(stringifyStyle(style)).toBe(
      'color:blue;font-size:14px;background-color:white;opacity:0.8;--custom-color:red;'
    )
  })

  it('should ignore non-string or non-number values in style object', () => {
    const style: any = {
      color: 'blue',
      fontSize: '14px',
      lineHeight: true,
      padding: null,
      margin: undefined
    }

    const expected = 'color:blue;font-size:14px;'
    expect(stringifyStyle(style)).toBe(expected)
  })
})

describe('normalizeStyle', () => {
  it('should normalize an array of styles', () => {
    const styles = [
      { color: 'blue' },
      'font-size: 14px',
      { backgroundColor: 'white', opacity: 0.5 }
    ]

    const expected = {
      color: 'blue',
      'font-size': '14px',
      backgroundColor: 'white',
      opacity: 0.5
    }

    expect(normalizeStyle(styles)).toEqual(expected)
  })

  it('should normalize a string array', () => {
    const styles = ['color: blue', 'font-size: 14px']
    const expected = {
      color: 'blue',
      'font-size': '14px'
    }
    expect(normalizeStyle(styles)).toEqual(expected)
  })

  it('should return the input string style', () => {
    const style = 'color: blue; font-size: 14px;'
    expect(normalizeStyle(style)).toBe(style)
  })

  it('should return the input object style', () => {
    const style = { color: 'blue', fontSize: 14 }
    expect(normalizeStyle(style)).toBe(style)
  })

  it('should return undefined for unsupported value types', () => {
    expect(normalizeStyle(null)).toBeUndefined()
    expect(normalizeStyle(123)).toBeUndefined()
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
      class: ['class1', 'class2']
    }
    const result = normalizeProps(props)
    expect(result).toEqual({
      class: 'class1 class2'
    })
  })

  test('should normalize class prop when it is an object', () => {
    const props = {
      class: {
        class1: true,
        class2: false,
        class3: true
      }
    }
    const result = normalizeProps(props)
    expect(result).toEqual({
      class: 'class1 class3'
    })
  })

  test('should normalize style prop', () => {
    const props = {
      style: ['color: blue', 'font-size: 14px']
    }
    const result = normalizeProps(props)
    expect(result).toEqual({
      style: {
        color: 'blue',
        'font-size': '14px'
      }
    })
  })

  test('should not modify props when class and style are already normalized', () => {
    const props = {
      class: 'class1 class2',
      style: {
        color: 'red',
        background: 'blue'
      }
    }
    const result = normalizeProps(props)
    expect(result).toEqual(props)
  })
})
