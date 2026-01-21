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

test('always close tags', () => {
  // button always needs closing tag unless on rightmost path
  checkAbbr(
    '<div><button>click</button></div>',
    '<div><button>click',
    '<div><button>click</button></div>',
  )
  checkAbbr(
    '<div><button>click</button><span>sibling</span></div>',
    '<div><button>click</button><span>sibling',
    '<div><button>click</button><span>sibling</span></div>',
  )

  // select always needs closing tag unless rightmost
  checkAbbr(
    '<div><select></select></div>',
    '<div><select>',
    '<div><select></select></div>',
  )
  checkAbbr(
    '<div><select></select><span>sibling</span></div>',
    '<div><select></select><span>sibling',
    '<div><select></select><span>sibling</span></div>',
  )

  // table always needs closing tag unless rightmost
  checkAbbr(
    '<div><table></table></div>',
    '<div><table>',
    '<div><table></table></div>',
  )
  checkAbbr(
    '<div><table></table><span>sibling</span></div>',
    '<div><table></table><span>sibling',
    '<div><table></table><span>sibling</span></div>',
  )

  // textarea always needs closing tag unless rightmost
  checkAbbr(
    '<div><textarea></textarea></div>',
    '<div><textarea>',
    '<div><textarea></textarea></div>',
  )
  checkAbbr(
    '<div><textarea></textarea><span>sibling</span></div>',
    '<div><textarea></textarea><span>sibling',
    '<div><textarea></textarea><span>sibling</span></div>',
  )

  // template always needs closing tag unless rightmost
  checkAbbr(
    '<div><template></template></div>',
    '<div><template>',
    '<div><template></template></div>',
  )
  checkAbbr(
    '<div><template></template><span>sibling</span></div>',
    '<div><template></template><span>sibling',
    '<div><template></template><span>sibling</span></div>',
  )

  // script always needs closing tag unless rightmost
  checkAbbr(
    '<div><script></script></div>',
    '<div><script>',
    '<div><script></script></div>',
  )
  checkAbbr(
    '<div><script></script><span>sibling</span></div>',
    '<div><script></script><span>sibling',
    '<div><script></script><span>sibling</span></div>',
  )

  // without always-close elements, normal abbreviation should work
  checkAbbr(
    '<div><form><input></form></div>',
    '<div><form><input>',
    '<div><form><input></form></div>',
  )
})

test('inline/block ancestor relationships', () => {
  // Inline element containing block element with sibling after inline
  // The block element must close because inline ancestor needs to close
  checkAbbr(
    '<div><span><div>text</div></span><p>after</p></div>',
    '<div><span><div>text</div></span><p>after',
    '<div><span><div>text</div></span><p>after</p></div>',
  )

  // Same situation but deeper nesting
  checkAbbr(
    '<div><span><p>text</p></span><span>after</span></div>',
    '<div><span><p>text</p></span><span>after',
    '<div><span><p>text</p></span><span>after</span></div>',
  )

  // Inline containing block on rightmost path - can omit
  checkAbbr(
    '<div><span><div>text</div></span></div>',
    '<div><span><div>text',
    '<div><span><div>text</div></span></div>',
  )

  // Normal case - no inline/block issue
  checkAbbr('<div><p>text</p></div>', '<div><p>text', '<div><p>text</p></div>')

  // Sibling after parent but no inline/block issue
  checkAbbr(
    '<div><div><p>text</p></div><span>after</span></div>',
    '<div><div><p>text</div><span>after',
    '<div><div><p>text</p></div><span>after</span></div>',
  )

  // Multi-level inline nesting with block inside
  // Outer span is not rightmost -> Needs close -> Inner block needs close
  checkAbbr(
    '<div><span><b><div>text</div></b></span><p>after</p></div>',
    '<div><span><b><div>text</div></b></span><p>after',
    '<div><span><b><div>text</div></b></span><p>after</p></div>',
  )

  // Mixed nesting: div > span > div > span > div
  // The middle div is inside a span that needs closing (because of outer structure)
  // Both inner divs need closing because they are inside spans that need closing
  checkAbbr(
    '<div><span><div><span><div>text</div></span></div></span><p>after</p></div>',
    '<div><span><div><span><div>text</div></div></span><p>after',
    '<div><span><div><span><div>text</div></span></div></span><p>after</p></div>',
  )
})
