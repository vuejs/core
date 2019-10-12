import { parse, transform, ElementNode, CallExpression } from '../../src'
import { transformOnce } from '../../src/transforms/vOnce'
import { transformElement } from '../../src/transforms/transformElement'
import { createObjectMatcher } from '../testUtils'

function transformWithOnce(template: string) {
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
    const node = transformWithOnce(`<div v-once />`)
    const codegenArgs = (node.codegenNode as CallExpression).arguments

    expect(codegenArgs[1]).toMatchObject(
      createObjectMatcher({
        $once: `[true]`
      })
    )
  })
})
