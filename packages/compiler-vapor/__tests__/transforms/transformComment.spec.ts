import {
  transformChildren,
  transformComment,
  transformElement,
  transformText,
  transformVIf,
} from '../../src'

import { makeCompile } from './_utils'

const compileWithCommentTransform = makeCompile({
  nodeTransforms: [
    transformVIf,
    transformElement,
    transformComment,
    transformChildren,
    transformText,
  ],
})

describe('compiler: comment transform', () => {
  describe('comment data is raw text', () => {
    // the template string is parsed as html again at runtime, and the html
    // parser never resolves character references inside a comment - escaping
    // the content would put the escape sequence itself into the dom
    test.each([
      [`<div><!--a & b--></div>`, '<div><!--a & b-->'],
      [`<div><!--a < b--></div>`, '<div><!--a < b-->'],
      [`<div><!--a > b--></div>`, '<div><!--a > b-->'],
      [`<div><!--a " b--></div>`, '<div><!--a " b-->'],
      [`<div><!--a ' b--></div>`, `<div><!--a ' b-->`],
      [`<div><!--&lt;--></div>`, '<div><!--&lt;-->'],
      [`<div><!--&nbsp;--></div>`, '<div><!--&nbsp;-->'],
      [`<div><!--<b class="x">--></div>`, '<div><!--<b class="x">-->'],
      [`<div><!--</div>--></div>`, '<div><!--</div>-->'],
      // the parser ends a comment at the first `-->` and resolves the abrupt
      // closings itself, so the content can never close the comment early
      [`<div><!--></div>`, '<div><!---->'],
      [`<div><!---></div>`, '<div><!---->'],
      [`<div><!--x---></div>`, '<div><!--x--->'],
      [`<div><!--a--b--></div>`, '<div><!--a--b-->'],
      [`<!--a & b-->`, '<!--a & b-->'],
    ])('%j compiles to %j', (source, template) => {
      const { ir } = compileWithCommentTransform(source)

      expect([...ir.template.keys()]).toContain(template)
    })
  })

  test('a comment kept for a v-else branch is not escaped either', () => {
    const { ir } = compileWithCommentTransform(
      `<div><span v-if="ok"/><!--a & b--><span v-else/></div>`,
    )

    expect([...ir.template.keys()]).toContain('<!--a & b-->')
  })
})
