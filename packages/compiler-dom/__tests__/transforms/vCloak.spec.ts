import {
  parse,
  transform,
  CompilerOptions,
  ElementNode,
  NodeTransform
} from '@vue/compiler-core'
import { transformCloak } from '../../src/transforms/vCloak'

function createTransformFunction(nodeTransforms: NodeTransform[] = []) {
  return (template: string, options: CompilerOptions = {}) => {
    const ast = parse(template)
    transform(ast, {
      nodeTransforms,
      ...options
    })
    return {
      root: ast,
      node: ast.children[0] as ElementNode
    }
  }
}

const transformWithCloak = createTransformFunction([transformCloak])
const transformWithoutCloak = createTransformFunction()

describe('compiler: `v-cloak` transform', () => {
  test('removes v-cloak without side effects', () => {
    const { node: cloakedNode } = transformWithCloak(`<div v-cloak/>`)
    const { node } = transformWithoutCloak('<div />')

    // The loc will be different if the templates are different
    // so for our comparison we need to remove them
    expect(withoutLoc(cloakedNode)).toEqual(withoutLoc(node))
  })
})

function withoutLoc<T extends ElementNode>(node: T) {
  const { loc, ...output } = node
  return output
}
