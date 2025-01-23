import {
  type CompilerOptions,
  type ElementNode,
  type IfNode,
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

    test('with text children', () => {
      const { node } = parseWithSkipTransform(`<div v-skip="ok">foo</div>`)
      expect(node.type).toBe(NodeTypes.SKIP)
      expect((node.test as SimpleExpressionNode).content).toBe(`ok`)
      expect(node.consequent.children.length).toBe(1)
      expect(node.consequent.children[0].type).toBe(NodeTypes.TEXT)
      expect((node.consequent.children[0] as any).content).toBe(`foo`)
      expect(node.alternate.children.length).toBe(1)
      expect(node.alternate.children[0].type).toBe(NodeTypes.ELEMENT)
      expect((node.alternate.children[0] as ElementNode).tag).toBe(`div`)
    })

    test('with element children', () => {
      const { node } = parseWithSkipTransform(`<div v-skip="ok"><span/></div>`)
      expect(node.type).toBe(NodeTypes.SKIP)
      expect((node.test as SimpleExpressionNode).content).toBe(`ok`)
      expect(node.consequent.children.length).toBe(1)
      expect(node.consequent.children[0].type).toBe(NodeTypes.ELEMENT)
      expect((node.consequent.children[0] as ElementNode).tag).toBe(`span`)
      expect(node.alternate.children.length).toBe(1)
      expect(node.alternate.children[0].type).toBe(NodeTypes.ELEMENT)
      expect((node.alternate.children[0] as ElementNode).tag).toBe(`div`)
    })

    test('with component children', () => {
      const { node } = parseWithSkipTransform(`<div v-skip="ok"><Comp/></div>`)
      expect(node.type).toBe(NodeTypes.SKIP)
      expect((node.test as SimpleExpressionNode).content).toBe(`ok`)
      expect(node.consequent.children.length).toBe(1)
      expect(node.consequent.children[0].type).toBe(NodeTypes.ELEMENT)
      expect((node.consequent.children[0] as ElementNode).tag).toBe(`Comp`)
      expect(node.alternate.children.length).toBe(1)
      expect(node.alternate.children[0].type).toBe(NodeTypes.ELEMENT)
      expect((node.alternate.children[0] as ElementNode).tag).toBe(`div`)
    })

    test('with multiple children', () => {
      const { node } = parseWithSkipTransform(
        `<div v-skip="ok"><span/><Comp/></div>`,
      )
      expect(node.type).toBe(NodeTypes.SKIP)
      expect((node.test as SimpleExpressionNode).content).toBe(`ok`)
      expect(node.consequent.children.length).toBe(2)
      expect(node.consequent.children[0].type).toBe(NodeTypes.ELEMENT)
      expect((node.consequent.children[0] as ElementNode).tag).toBe(`span`)
      expect(node.consequent.children[1].type).toBe(NodeTypes.ELEMENT)
      expect((node.consequent.children[1] as ElementNode).tag).toBe(`Comp`)
      expect(node.alternate.children.length).toBe(1)
      expect(node.alternate.children[0].type).toBe(NodeTypes.ELEMENT)
      expect((node.alternate.children[0] as ElementNode).tag).toBe(`div`)
    })

    test('nested v-skip', () => {
      const { node } = parseWithSkipTransform(
        `<div v-skip="ok"><div v-skip="nested"/></div>`,
      )
      expect(node.type).toBe(NodeTypes.SKIP)
      expect((node.test as SimpleExpressionNode).content).toBe(`ok`)
      expect(node.consequent.children.length).toBe(1)
      expect(node.consequent.children[0].type).toBe(NodeTypes.SKIP)
      expect(
        ((node.consequent.children[0] as SkipNode).test as SimpleExpressionNode)
          .content,
      ).toBe(`nested`)
      expect(node.alternate.children.length).toBe(1)
      expect(node.alternate.children[0].type).toBe(NodeTypes.ELEMENT)
      expect((node.alternate.children[0] as ElementNode).tag).toBe(`div`)
    })

    test('v-if + v-skip', () => {
      const { node } = parseWithSkipTransform(
        `<div v-if="ok" v-skip="nested"/>`,
      )
      expect(node.type).toBe(NodeTypes.IF)
      const ifNode = node as unknown as IfNode
      const branch = ifNode.branches[0]
      expect((branch.condition as SimpleExpressionNode).content).toBe(`ok`)
      expect(branch.children.length).toBe(1)
      // skipNode
      expect(branch.children[0].type).toBe(NodeTypes.SKIP)
      expect(
        ((branch.children[0] as SkipNode).test as SimpleExpressionNode).content,
      ).toBe(`nested`)
    })

    test('v-else + v-skip', () => {
      const { node } = parseWithSkipTransform(
        `<div v-if="ok"/><div v-else v-skip="nested"/>`,
      )
      expect(node.type).toBe(NodeTypes.IF)
      const elseNode = node as unknown as IfNode
      const branch = elseNode.branches[1]
      expect(branch.children.length).toBe(1)
      // skipNode
      expect(branch.children[0].type).toBe(NodeTypes.SKIP)
      expect(
        ((branch.children[0] as SkipNode).test as SimpleExpressionNode).content,
      ).toBe(`nested`)
    })

    test('v-else-if + v-skip', () => {
      const { node } = parseWithSkipTransform(
        `<div v-if="ok"/><div v-else-if="yes" v-skip="nested"/>`,
      )
      expect(node.type).toBe(NodeTypes.IF)
      const elseIfNode = node as unknown as IfNode
      const branch = elseIfNode.branches[1]
      expect((branch.condition as SimpleExpressionNode).content).toBe(`yes`)
      expect(branch.children.length).toBe(1)
      // skipNode
      expect(branch.children[0].type).toBe(NodeTypes.SKIP)
      expect(
        ((branch.children[0] as SkipNode).test as SimpleExpressionNode).content,
      ).toBe(`nested`)
    })

    test('on component', () => {
      const { node } = parseWithSkipTransform(`<Comp v-skip="ok"/>`)
      expect(node.type).toBe(NodeTypes.SKIP)
      expect((node.test as SimpleExpressionNode).content).toBe(`ok`)
      expect(node.consequent.children.length).toBe(0)
      expect(node.alternate.children.length).toBe(1)
      expect(node.alternate.children[0].type).toBe(NodeTypes.ELEMENT)
      expect((node.alternate.children[0] as ElementNode).tag).toBe(`Comp`)
    })

    test('on component with default slot', () => {
      const { node } = parseWithSkipTransform(`<Comp v-skip="ok">foo</Comp>`)
      expect(node.type).toBe(NodeTypes.SKIP)
      expect((node.test as SimpleExpressionNode).content).toBe(`ok`)
      expect(node.consequent.children.length).toBe(1)
      expect(node.consequent.children[0].type).toBe(NodeTypes.TEXT)
      expect((node.consequent.children[0] as any).content).toBe(`foo`)
      expect(node.alternate.children.length).toBe(1)
      expect(node.alternate.children[0].type).toBe(NodeTypes.ELEMENT)
      expect((node.alternate.children[0] as ElementNode).tag).toBe(`Comp`)
    })

    test('on component with multiple named slot', () => {
      const { node } = parseWithSkipTransform(
        `<Comp v-skip="ok">
          <template #default>default</template>
          <template #foo>foo</template>
        </Comp>`,
      )
      expect(node.type).toBe(NodeTypes.SKIP)
      expect((node.test as SimpleExpressionNode).content).toBe(`ok`)
      expect(node.consequent.children.length).toBe(1)
      expect(node.consequent.children[0].type).toBe(NodeTypes.TEXT)
      expect((node.consequent.children[0] as any).content).toBe(`default`)
      expect(node.alternate.children.length).toBe(1)
      expect(node.alternate.children[0].type).toBe(NodeTypes.ELEMENT)
      expect((node.alternate.children[0] as ElementNode).tag).toBe(`Comp`)
    })

    test('on component with multiple implicit slot', () => {
      const { node } = parseWithSkipTransform(
        `<Comp v-skip="ok">
          <span/>
          <template #foo>foo</template>
          <div/>
        </Comp>`,
      )
      expect(node.type).toBe(NodeTypes.SKIP)
      expect((node.test as SimpleExpressionNode).content).toBe(`ok`)
      expect(node.consequent.children.length).toBe(2)
      expect(node.consequent.children[0].type).toBe(NodeTypes.ELEMENT)
      expect((node.consequent.children[0] as ElementNode).tag).toBe(`span`)
      expect(node.consequent.children[1].type).toBe(NodeTypes.ELEMENT)
      expect((node.consequent.children[1] as ElementNode).tag).toBe(`div`)
      expect(node.alternate.children.length).toBe(1)
      expect(node.alternate.children[0].type).toBe(NodeTypes.ELEMENT)
      expect((node.alternate.children[0] as ElementNode).tag).toBe(`Comp`)
    })
  })

  describe.todo('codegen', () => {})

  describe.todo('errors', () => {})
})
