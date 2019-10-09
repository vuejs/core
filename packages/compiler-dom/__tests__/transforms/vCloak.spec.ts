import {
  parse,
  transform,
  CompilerOptions,
  ElementNode
} from '@vue/compiler-core'
import { transformCloak } from '../../src/transforms/vCloak'
import { transformElement } from '../../../compiler-core/src/transforms/transformElement'
import { CallExpression } from '../../src'

function transformWithCloak(template: string, options: CompilerOptions = {}) {
  const ast = parse(template)
  transform(ast, {
    nodeTransforms: [transformElement],
    directiveTransforms: {
      cloak: transformCloak
    },
    ...options
  })
  return ast.children[0] as ElementNode
}

describe('compiler: `v-cloak` transform', () => {
  test('should add no props to DOM', () => {
    const node = transformWithCloak(`<div v-cloak/>`)
    const codegenArgs = (node.codegenNode as CallExpression).arguments

    // As v-cloak adds no properties the codegen should be identical to
    // rendering a div with no props or reactive data (so just the tag as the arg)
    expect(codegenArgs.length).toBe(1)
  })
})
