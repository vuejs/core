import {
  baseParse as parse,
  transform,
  PlainElementNode,
  CompilerOptions
} from '@vue/compiler-core'
import { transformVHtml } from '../../src/transforms/vHtml'
import { transformElement } from '../../../compiler-core/src/transforms/transformElement'
import {
  createObjectMatcher,
  genFlagText
} from '../../../compiler-core/__tests__/testUtils'
import { PatchFlags } from '@vue/shared'
import { DOMErrorCodes } from '../../src/errors'

function transformWithVHtml(template: string, options: CompilerOptions = {}) {
  const ast = parse(template)
  transform(ast, {
    nodeTransforms: [transformElement],
    directiveTransforms: {
      html: transformVHtml
    },
    ...options
  })
  return ast
}

describe('compiler: v-html transform', () => {
  it('should convert v-html to innerHTML', () => {
    const ast = transformWithVHtml(`<div v-html="test"/>`)
    expect((ast.children[0] as PlainElementNode).codegenNode).toMatchObject({
      tag: `"div"`,
      props: createObjectMatcher({
        innerHTML: `[test]`
      }),
      children: undefined,
      patchFlag: genFlagText(PatchFlags.PROPS),
      dynamicProps: `["innerHTML"]`
    })
  })

  it('should raise error and ignore children when v-html is present', () => {
    const onError = jest.fn()
    const ast = transformWithVHtml(`<div v-html="test">hello</div>`, {
      onError
    })
    expect(onError.mock.calls).toMatchObject([
      [{ code: DOMErrorCodes.X_V_HTML_WITH_CHILDREN }]
    ])
    expect((ast.children[0] as PlainElementNode).codegenNode).toMatchObject({
      tag: `"div"`,
      props: createObjectMatcher({
        innerHTML: `[test]`
      }),
      children: undefined, // <-- children should have been removed
      patchFlag: genFlagText(PatchFlags.PROPS),
      dynamicProps: `["innerHTML"]`
    })
  })

  it('should raise error if has no expression', () => {
    const onError = jest.fn()
    transformWithVHtml(`<div v-html></div>`, {
      onError
    })
    expect(onError.mock.calls).toMatchObject([
      [{ code: DOMErrorCodes.X_V_HTML_NO_EXPRESSION }]
    ])
  })
})
