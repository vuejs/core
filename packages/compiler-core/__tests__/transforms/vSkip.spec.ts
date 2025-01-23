import {
  type CompilerOptions,
  type ElementNode,
  NodeTypes,
  type RootNode,
  type SimpleExpressionNode,
  type SkipNode,
  baseParse as parse,
  transform,
  transformBind,
  transformElement,
} from '@vue/compiler-core'
import { transformIf } from '../../src/transforms/vIf'
import { transformFor } from '../../src/transforms/vFor'
import { transformSlotOutlet } from '../../src/transforms/transformSlotOutlet'
import { transformSkip } from '../../src/transforms/vSkip'

export function parseWithSkipTransform(
  template: string,
  options: CompilerOptions = {},
): {
  root: RootNode
  node: SkipNode
} {
  const ast = parse(template, options)
  transform(ast, {
    nodeTransforms: [
      transformIf,
      transformSkip,
      transformFor,
      transformSlotOutlet,
      transformElement,
    ],
    directiveTransforms: {
      bind: transformBind,
    },
    ...options,
  })
  return {
    root: ast,
    node: ast.children[0] as SkipNode,
  }
}

describe('compiler: v-skip', () => {
  describe('transform', () => {
    test('basic', () => {
      const { node } = parseWithSkipTransform(`<div v-skip="ok"/>`)
      expect(node.type).toBe(NodeTypes.SKIP)
      expect((node.test as SimpleExpressionNode).content).toBe(`ok`)
      expect(node.consequent.children.length).toBe(0)
      expect(node.alternate.children.length).toBe(1)
      expect(node.alternate.children[0].type).toBe(NodeTypes.ELEMENT)
      expect((node.alternate.children[0] as ElementNode).tag).toBe(`div`)
    })
  })

  describe.todo('codegen', () => {})

  describe.todo('errors', () => {})
})
