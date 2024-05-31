import {
  type CompilerOptions,
  type PlainElementNode,
  baseParse as parse,
  transform,
} from '@vue/compiler-core'
import { transformVText } from '../../src/transforms/vText'
import { transformElement } from '../../../compiler-core/src/transforms/transformElement'
import {
  createObjectMatcher,
  genFlagText,
} from '../../../compiler-core/__tests__/testUtils'
import { PatchFlags } from '@vue/shared'
import { DOMErrorCodes } from '../../src/errors'

function transformWithVText(template: string, options: CompilerOptions = {}) {
  const ast = parse(template)
  transform(ast, {
    nodeTransforms: [transformElement],
    directiveTransforms: {
      text: transformVText,
    },
    ...options,
  })
  return ast
}

describe('compiler: v-text transform', () => {
  it('should convert v-text to textContent', () => {
    const ast = transformWithVText(`<div v-text="test"/>`)
    expect((ast.children[0] as PlainElementNode).codegenNode).toMatchObject({
      tag: `"div"`,
      props: createObjectMatcher({
        textContent: {
          arguments: [{ content: 'test' }],
        },
      }),
      children: undefined,
      patchFlag: genFlagText(PatchFlags.PROPS),
      dynamicProps: `["textContent"]`,
    })
  })

  it('should raise error and ignore children when v-text is present', () => {
    const onError = vi.fn()
    const ast = transformWithVText(`<div v-text="test">hello</div>`, {
      onError,
    })
    expect(onError.mock.calls).toMatchObject([
      [{ code: DOMErrorCodes.X_V_TEXT_WITH_CHILDREN }],
    ])
    expect((ast.children[0] as PlainElementNode).codegenNode).toMatchObject({
      tag: `"div"`,
      props: createObjectMatcher({
        textContent: {
          arguments: [{ content: 'test' }],
        },
      }),
      children: undefined, // <-- children should have been removed
      patchFlag: genFlagText(PatchFlags.PROPS),
      dynamicProps: `["textContent"]`,
    })
  })

  it('should raise error if has no expression', () => {
    const onError = vi.fn()
    transformWithVText(`<div v-text></div>`, {
      onError,
    })
    expect(onError.mock.calls).toMatchObject([
      [{ code: DOMErrorCodes.X_V_TEXT_NO_EXPRESSION }],
    ])
  })
})
