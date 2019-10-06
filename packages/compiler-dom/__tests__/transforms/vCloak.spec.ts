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
    const { root: cloakedRoot } = transformWithCloak(`<div v-cloak/>`)
    const { root } = transformWithoutCloak('<div />')

    // The loc will be different as the templates are different
    // so for our comparison we need to remove them
    expect(withoutLoc(cloakedRoot)).toEqual(withoutLoc(root))
  })
})

function withoutLoc<T extends any>(node: T): Omit<T, 'loc'> {
  const { loc, ...output }: any = node
  if (output.children) {
    output.children = output.children.map(withoutLoc)
  }
  if (output.codegenNode) {
    output.codegenNode = withoutLoc(output.codegenNode)
  }
  return output
}
