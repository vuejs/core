/**
 * @vitest-environment jsdom
 */

import { compile } from '../src'

const parser: DOMParser = new DOMParser()

function parseHTML(html: string): string {
  return parser.parseFromString(html, 'text/html').body.innerHTML
}

function getCompiledTemplates(template: string): string[] {
  const { ast } = compile(template)
  return Array.from(ast.template.keys())
}

function checkAbbr(
  template: string,
  abbreviation: string | string[],
  expected: string | string[],
): void {
  const abbreviations = Array.isArray(abbreviation)
    ? abbreviation
    : [abbreviation]
  const expectations = Array.isArray(expected) ? expected : [expected]
  // verify compiler generates the abbreviated templates
  expect(getCompiledTemplates(template)).toEqual(abbreviations)
  // verify browser parses each abbreviation back to expected HTML
  abbreviations.forEach((abbr, i) => {
    expect(parseHTML(abbr)).toBe(expectations[i])
  })
}

test('template abbreviation', () => {
  // basic - last child can omit closing tag
  checkAbbr('<div>hello</div>', '<div>hello', '<div>hello</div>')
  checkAbbr(
    '<div><div>hello</div></div>',
    '<div><div>hello',
    '<div><div>hello</div></div>',
  )

  // non-last child needs closing tag
  checkAbbr(
    '<div><span>foo</span><span></span></div>',
    '<div><span>foo</span><span>',
    '<div><span>foo</span><span></span></div>',
  )
  checkAbbr(
    '<div><hr><div></div></div>',
    '<div><hr><div>',
    '<div><hr><div></div></div>',
  )
  checkAbbr(
    '<div><div></div><hr></div>',
    '<div><div></div><hr>',
    '<div><div></div><hr></div>',
  )

  // multi-root: each root generates its own template
  checkAbbr(
    '<span></span>hello',
    ['<span>', 'hello'],
    ['<span></span>', 'hello'],
  )
})

test('formatting tags', () => {
  // formatting tags on rightmost path can omit closing tag
  checkAbbr('<div><b>bold</b></div>', '<div><b>bold', '<div><b>bold</b></div>')
  checkAbbr(
    '<div><i><b>text</b></i></div>',
    '<div><i><b>text',
    '<div><i><b>text</b></i></div>',
  )

  // formatting tags NOT on rightmost path need closing tag
  checkAbbr(
    '<div><b>bold</b><span></span></div>',
    '<div><b>bold</b><span>',
    '<div><b>bold</b><span></span></div>',
  )
  checkAbbr(
    '<div><b>1</b><b>2</b></div>',
    '<div><b>1</b><b>2',
    '<div><b>1</b><b>2</b></div>',
  )
})

test('same-name nested tags', () => {
  // same-name on rightmost path can omit
  checkAbbr(
    '<div><div>inner</div></div>',
    '<div><div>inner',
    '<div><div>inner</div></div>',
  )

  // same-name NOT on rightmost path needs closing tag
  checkAbbr(
    '<div><div>a</div><div>b</div></div>',
    '<div><div>a</div><div>b',
    '<div><div>a</div><div>b</div></div>',
  )
  checkAbbr(
    '<span><span>1</span><span>2</span></span>',
    '<span><span>1</span><span>2',
    '<span><span>1</span><span>2</span></span>',
  )
})

test('void tags', () => {
  // void tags never need closing tags
  checkAbbr('<div><br></div>', '<div><br>', '<div><br></div>')
  checkAbbr('<div><hr></div>', '<div><hr>', '<div><hr></div>')
  checkAbbr('<div><input></div>', '<div><input>', '<div><input></div>')
  checkAbbr('<div><img></div>', '<div><img>', '<div><img></div>')
})

test('deeply nested', () => {
  checkAbbr(
    '<div><div><div><span>deep</span></div></div></div>',
    '<div><div><div><span>deep',
    '<div><div><div><span>deep</span></div></div></div>',
  )
  checkAbbr(
    '<div><div><span>a</span><span>b</span></div></div>',
    '<div><div><span>a</span><span>b',
    '<div><div><span>a</span><span>b</span></div></div>',
  )
})
