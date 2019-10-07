import {
  parse,
  transform,
  CompilerOptions,
  ElementNode,
  NodeTypes
} from '@vue/compiler-core'
import { transformCloak } from '../../src/transforms/vCloak'

function transformWithCloak(template: string, options: CompilerOptions = {}) {
  const ast = parse(template)
  transform(ast, {
    directiveTransforms: {
      cloak: transformCloak
    },
    ...options
  })
  return {
    root: ast,
    node: ast.children[0] as ElementNode
  }
}

describe('compiler: `v-cloak` transform', () => {
  test('should add no props to DOM', () => {
    const { node } = transformWithCloak(`<div v-cloak/>`)

    expect(node.props.length).toBe(1)
    expect(node.props[0]).toMatchObject({
      type: NodeTypes.DIRECTIVE,
      name: `cloak`,
      arg: undefined,
      exp: undefined
    })
  })
})
