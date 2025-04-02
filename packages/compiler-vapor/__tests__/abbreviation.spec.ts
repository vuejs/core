/**
 * @vitest-environment jsdom
 */

const parser: DOMParser = new DOMParser()

function parseHTML(html: string): string {
  return parser.parseFromString(html, 'text/html').body.innerHTML
}

function checkAbbr(
  template: string,
  abbrevation: string,
  expected: string,
): void {
  // TODO do some optimzations to make sure template === abbrevation
  expect(parseHTML(abbrevation)).toBe(expected)
}

test('template abbreviation', () => {
  checkAbbr('<div>hello</div>', '<div>hello', '<div>hello</div>')
  checkAbbr(
    '<div><div>hello</div></div>',
    '<div><div>hello',
    '<div><div>hello</div></div>',
  )
  checkAbbr(
    '<div><span>foo</span><span/></div>',
    '<div><span>foo</span><span>',
    '<div><span>foo</span><span></span></div>',
  )
  checkAbbr(
    '<div><hr/><div/></div>',
    '<div><hr><div>',
    '<div><hr><div></div></div>',
  )
  checkAbbr(
    '<div><div/><hr/></div>',
    '<div><div></div><hr>',
    '<div><div></div><hr></div>',
  )

  checkAbbr('<span/>hello', '<span></span>hello', '<span></span>hello')
})
