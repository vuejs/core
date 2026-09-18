import { type CompilerError, compile } from '../../src'
import { isValidHTMLNesting } from '../../src/htmlNesting'

describe('validate html nesting', () => {
  it('should warn with p > div', () => {
    let err: CompilerError | undefined
    compile(`<p><div></div></p>`, {
      onWarn: e => (err = e),
    })
    expect(err).toBeDefined()
    expect(err!.message).toMatch(`<div> cannot be child of <p>`)
  })

  it('should not warn with select > hr', () => {
    let err: CompilerError | undefined
    compile(`<select><hr></select>`, {
      onWarn: e => (err = e),
    })
    expect(err).toBeUndefined()
  })

  // #13318
  it('should not warn when parent tag is template', () => {
    let err: CompilerError | undefined
    compile(`<template><tr/></template>`, {
      onWarn: e => (err = e),
    })
    expect(err).toBeUndefined()
  })
})

/**
 * Copied from https://github.com/MananTank/validate-html-nesting
 * with ISC license
 */
describe('isValidHTMLNesting', () => {
  test('form', () => {
    // invalid
    expect(isValidHTMLNesting('form', 'form')).toBe(false)

    // valid
    expect(isValidHTMLNesting('form', 'div')).toBe(true)
    expect(isValidHTMLNesting('form', 'input')).toBe(true)
    expect(isValidHTMLNesting('form', 'select')).toBe(true)
    expect(isValidHTMLNesting('form', 'button')).toBe(true)
    expect(isValidHTMLNesting('form', 'label')).toBe(true)
    expect(isValidHTMLNesting('form', 'h1')).toBe(true)
  })

  test('p', () => {
    // invalid
    expect(isValidHTMLNesting('p', 'p')).toBe(false)
    expect(isValidHTMLNesting('p', 'div')).toBe(false)
    expect(isValidHTMLNesting('p', 'hr')).toBe(false)
    expect(isValidHTMLNesting('p', 'blockquote')).toBe(false)
    expect(isValidHTMLNesting('p', 'pre')).toBe(false)

    // valid
    expect(isValidHTMLNesting('p', 'a')).toBe(true)
    expect(isValidHTMLNesting('p', 'span')).toBe(true)
    expect(isValidHTMLNesting('p', 'abbr')).toBe(true)
    expect(isValidHTMLNesting('p', 'button')).toBe(true)
    expect(isValidHTMLNesting('p', 'b')).toBe(true)
    expect(isValidHTMLNesting('p', 'i')).toBe(true)
    expect(isValidHTMLNesting('p', 'input')).toBe(true)
    expect(isValidHTMLNesting('p', 'label')).toBe(true)
  })

  test('a', () => {
    // invalid
    expect(isValidHTMLNesting('a', 'a')).toBe(false)

    // valid
    expect(isValidHTMLNesting('a', 'div')).toBe(true)
    expect(isValidHTMLNesting('a', 'span')).toBe(true)
  })

  test('button', () => {
    // invalid
    expect(isValidHTMLNesting('button', 'button')).toBe(false)

    // valid
    expect(isValidHTMLNesting('button', 'div')).toBe(true)
    expect(isValidHTMLNesting('button', 'span')).toBe(true)
  })

  test('table', () => {
    // invalid
    expect(isValidHTMLNesting('table', 'tr')).toBe(false)
    expect(isValidHTMLNesting('table', 'table')).toBe(false)
    expect(isValidHTMLNesting('table', 'td')).toBe(false)

    // valid
    expect(isValidHTMLNesting('table', 'thead')).toBe(true)
    expect(isValidHTMLNesting('table', 'tbody')).toBe(true)
    expect(isValidHTMLNesting('table', 'tfoot')).toBe(true)
    expect(isValidHTMLNesting('table', 'caption')).toBe(true)
    expect(isValidHTMLNesting('table', 'colgroup')).toBe(true)
  })

  test('td', () => {
    // valid
    expect(isValidHTMLNesting('td', 'span')).toBe(true)
    expect(isValidHTMLNesting('tr', 'td')).toBe(true)

    // invalid
    expect(isValidHTMLNesting('td', 'td')).toBe(false)
    expect(isValidHTMLNesting('div', 'td')).toBe(false)
  })

  test('tbody', () => {
    // invalid
    expect(isValidHTMLNesting('tbody', 'td')).toBe(false)

    // valid
    expect(isValidHTMLNesting('tbody', 'tr')).toBe(true)
  })

  test('tr', () => {
    // invalid
    expect(isValidHTMLNesting('tr', 'tr')).toBe(false)
    expect(isValidHTMLNesting('table', 'tr')).toBe(false)

    // valid
    expect(isValidHTMLNesting('tbody', 'tr')).toBe(true)
    expect(isValidHTMLNesting('thead', 'tr')).toBe(true)
    expect(isValidHTMLNesting('tfoot', 'tr')).toBe(true)
    expect(isValidHTMLNesting('tr', 'td')).toBe(true)
    expect(isValidHTMLNesting('tr', 'th')).toBe(true)
  })

  test('li', () => {
    // invalid
    expect(isValidHTMLNesting('li', 'li')).toBe(false)
    // valid
    expect(isValidHTMLNesting('li', 'div')).toBe(true)
    expect(isValidHTMLNesting('li', 'ul')).toBe(true)
  })

  test('headings', () => {
    // invalid
    expect(isValidHTMLNesting('h1', 'h1')).toBe(false)
    expect(isValidHTMLNesting('h2', 'h1')).toBe(false)
    expect(isValidHTMLNesting('h3', 'h1')).toBe(false)
    expect(isValidHTMLNesting('h1', 'h6')).toBe(false)

    // valid
    expect(isValidHTMLNesting('h1', 'div')).toBe(true)
  })

  describe('SVG', () => {
    test('svg', () => {
      // invalid non-svg tags as children
      expect(isValidHTMLNesting('svg', 'div')).toBe(false)
      expect(isValidHTMLNesting('svg', 'img')).toBe(false)
      expect(isValidHTMLNesting('svg', 'p')).toBe(false)
      expect(isValidHTMLNesting('svg', 'h2')).toBe(false)
      expect(isValidHTMLNesting('svg', 'span')).toBe(false)

      // valid non-svg tags as children
      expect(isValidHTMLNesting('svg', 'a')).toBe(true)
      expect(isValidHTMLNesting('svg', 'textarea')).toBe(true)
      expect(isValidHTMLNesting('svg', 'input')).toBe(true)
      expect(isValidHTMLNesting('svg', 'select')).toBe(true)

      // valid svg tags as children
      expect(isValidHTMLNesting('svg', 'g')).toBe(true)
      expect(isValidHTMLNesting('svg', 'ellipse')).toBe(true)
      expect(isValidHTMLNesting('svg', 'feOffset')).toBe(true)
    })

    test('foreignObject', () => {
      // valid
      expect(isValidHTMLNesting('foreignObject', 'g')).toBe(true)
      expect(isValidHTMLNesting('foreignObject', 'div')).toBe(true)
      expect(isValidHTMLNesting('foreignObject', 'a')).toBe(true)
      expect(isValidHTMLNesting('foreignObject', 'textarea')).toBe(true)
    })

    test('g', () => {
      // valid
      expect(isValidHTMLNesting('g', 'div')).toBe(true)
      expect(isValidHTMLNesting('g', 'p')).toBe(true)
      expect(isValidHTMLNesting('g', 'a')).toBe(true)
      expect(isValidHTMLNesting('g', 'textarea')).toBe(true)
      expect(isValidHTMLNesting('g', 'g')).toBe(true)
    })

    test('dl', () => {
      // valid
      expect(isValidHTMLNesting('dl', 'dt')).toBe(true)
      expect(isValidHTMLNesting('dl', 'dd')).toBe(true)
      expect(isValidHTMLNesting('dl', 'div')).toBe(true)
      expect(isValidHTMLNesting('div', 'dt')).toBe(true)
      expect(isValidHTMLNesting('div', 'dd')).toBe(true)

      // invalid
      expect(isValidHTMLNesting('span', 'dt')).toBe(false)
      expect(isValidHTMLNesting('span', 'dd')).toBe(false)
    })
  })
})
