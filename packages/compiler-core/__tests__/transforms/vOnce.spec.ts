import { parse, transform, ElementNode, CallExpression } from '../../src'
import { transformOnce } from '../../src/transforms/vOnce'
import { transformElement } from '../../src/transforms/transformElement'
import { createObjectMatcher } from '../testUtils'

function transformWithCloak(template: string) {
  const ast = parse(template)
  transform(ast, {
    nodeTransforms: [transformElement],
    directiveTransforms: {
      once: transformOnce
    }
  })
  return ast.children[0] as ElementNode
}

describe('compiler: v-once transform', () => {
  test('should add no props to DOM', () => {
    const node = transformWithCloak(`<div v-once />`)
    const codegenArgs = (node.codegenNode as CallExpression).arguments

    // As v-cloak adds no properties the codegen should be identical to
    // rendering a div with no props or reactive data (so just the tag as the arg)
    expect(codegenArgs[1]).toMatchObject(
      createObjectMatcher({
        $once: `[true]`
      })
    )
  })
})
