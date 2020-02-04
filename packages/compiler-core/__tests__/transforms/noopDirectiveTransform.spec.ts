import {
  baseParse as parse,
  transform,
  ElementNode,
  CallExpression,
  noopDirectiveTransform
} from '../../src'
import { transformElement } from '../../src/transforms/transformElement'

describe('compiler: noop directive transform', () => {
  test('should add no props to DOM', () => {
    const ast = parse(`<div v-noop/>`)
    transform(ast, {
      nodeTransforms: [transformElement],
      directiveTransforms: {
        noop: noopDirectiveTransform
      }
    })
    const node = ast.children[0] as ElementNode
    const codegenArgs = (node.codegenNode as CallExpression).arguments

    // As v-noop adds no properties the codegen should be identical to
    // rendering a div with no props or reactive data (so just the tag as the arg)
    expect(codegenArgs.length).toBe(1)
  })
})
