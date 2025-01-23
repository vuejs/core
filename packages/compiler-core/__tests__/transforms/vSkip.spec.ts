import {
  type CompilerOptions,
  type ElementNode,
  ElementTypes,
  ErrorCodes,
  type IfBranchNode,
  type IfNode,
  NodeTypes,
  type RootNode,
  type SimpleExpressionNode,
  type SkipNode,
  generate,
  baseParse as parse,
  transform,
  transformElement,
  transformExpression,
} from '@vue/compiler-core'
import { transformIf } from '../../src/transforms/vIf'
import { transformFor } from '../../src/transforms/vFor'
import { transformSlotOutlet } from '../../src/transforms/transformSlotOutlet'
import { transformSkip } from '../../src/transforms/vSkip'

export function parseWithSkipTransform(
  template: string,
  options: CompilerOptions = { prefixIdentifiers: true },
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
      transformExpression,
      transformSlotOutlet,
      transformElement,
    ],
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
      const { root, node } = parseWithSkipTransform(`<div v-skip="ok"/>`)
      expect(node.type).toBe(NodeTypes.SKIP)
      expect((node.test as SimpleExpressionNode).content).toBe(`_ctx.ok`)
      expect(node.consequent.type === NodeTypes.JS_CALL_EXPRESSION).toBe(true)
      expect(node.alternate.children.length).toBe(1)
      expect(node.alternate.children[0].type).toBe(NodeTypes.ELEMENT)
      expect((node.alternate.children[0] as ElementNode).tag).toBe(`div`)
      expect(generate(root).code).toMatchSnapshot()
    })

    test('with text children', () => {
      const { root, node } = parseWithSkipTransform(
        `<div v-skip="ok">foo</div>`,
      )
      expect(node.type).toBe(NodeTypes.SKIP)
      expect((node.test as SimpleExpressionNode).content).toBe(`_ctx.ok`)
      expect((node.consequent as IfBranchNode).children.length).toBe(1)
      expect((node.consequent as IfBranchNode).children[0].type).toBe(
        NodeTypes.TEXT,
      )
      expect(
        ((node.consequent as IfBranchNode).children[0] as any).content,
      ).toBe(`foo`)
      expect(node.alternate.children.length).toBe(1)
      expect(node.alternate.children[0].type).toBe(NodeTypes.ELEMENT)
      expect((node.alternate.children[0] as ElementNode).tag).toBe(`div`)
      expect(generate(root).code).toMatchSnapshot()
    })

    test('with element children', () => {
      const { root, node } = parseWithSkipTransform(
        `<div v-skip="ok"><span/></div>`,
      )
      expect(node.type).toBe(NodeTypes.SKIP)
      expect((node.test as SimpleExpressionNode).content).toBe(`_ctx.ok`)
      expect((node.consequent as IfBranchNode).children.length).toBe(1)
      expect((node.consequent as IfBranchNode).children[0].type).toBe(
        NodeTypes.ELEMENT,
      )
      expect(
        ((node.consequent as IfBranchNode).children[0] as ElementNode).tag,
      ).toBe(`span`)
      expect(node.alternate.children.length).toBe(1)
      expect(node.alternate.children[0].type).toBe(NodeTypes.ELEMENT)
      expect((node.alternate.children[0] as ElementNode).tag).toBe(`div`)
      expect(generate(root).code).toMatchSnapshot()
    })

    test('with component children', () => {
      const { root, node } = parseWithSkipTransform(
        `<div v-skip="ok"><Comp/></div>`,
      )
      expect(node.type).toBe(NodeTypes.SKIP)
      expect((node.test as SimpleExpressionNode).content).toBe(`_ctx.ok`)
      expect((node.consequent as IfBranchNode).children.length).toBe(1)
      expect((node.consequent as IfBranchNode).children[0].type).toBe(
        NodeTypes.ELEMENT,
      )
      expect(
        ((node.consequent as IfBranchNode).children[0] as ElementNode).tag,
      ).toBe(`Comp`)
      expect(node.alternate.children.length).toBe(1)
      expect(node.alternate.children[0].type).toBe(NodeTypes.ELEMENT)
      expect((node.alternate.children[0] as ElementNode).tag).toBe(`div`)
      expect(generate(root).code).toMatchSnapshot()
    })

    test('with multiple children', () => {
      const { root, node } = parseWithSkipTransform(
        `<div v-skip="ok"><span/><Comp/></div>`,
      )
      expect(node.type).toBe(NodeTypes.SKIP)
      expect((node.test as SimpleExpressionNode).content).toBe(`_ctx.ok`)
      expect((node.consequent as IfBranchNode).children.length).toBe(2)
      expect((node.consequent as IfBranchNode).children[0].type).toBe(
        NodeTypes.ELEMENT,
      )
      expect(
        ((node.consequent as IfBranchNode).children[0] as ElementNode).tag,
      ).toBe(`span`)
      expect((node.consequent as IfBranchNode).children[1].type).toBe(
        NodeTypes.ELEMENT,
      )
      expect(
        ((node.consequent as IfBranchNode).children[1] as ElementNode).tag,
      ).toBe(`Comp`)
      expect(node.alternate.children.length).toBe(1)
      expect(node.alternate.children[0].type).toBe(NodeTypes.ELEMENT)
      expect((node.alternate.children[0] as ElementNode).tag).toBe(`div`)
      expect(generate(root).code).toMatchSnapshot()
    })

    test('nested v-skip', () => {
      const { root, node } = parseWithSkipTransform(
        `<div v-skip="ok"><span v-skip="nested"/></div>`,
      )
      expect(node.type).toBe(NodeTypes.SKIP)
      expect((node.test as SimpleExpressionNode).content).toBe(`_ctx.ok`)
      expect((node.consequent as IfBranchNode).children.length).toBe(1)
      expect((node.consequent as IfBranchNode).children[0].type).toBe(
        NodeTypes.SKIP,
      )
      expect(
        (
          ((node.consequent as IfBranchNode).children[0] as SkipNode)
            .test as SimpleExpressionNode
        ).content,
      ).toBe(`_ctx.nested`)
      expect(node.alternate.children.length).toBe(1)
      expect(node.alternate.children[0].type).toBe(NodeTypes.ELEMENT)
      expect((node.alternate.children[0] as ElementNode).tag).toBe(`div`)
      const nestedNode = (node.consequent as IfBranchNode)
        .children[0] as SkipNode
      expect(nestedNode.type).toBe(NodeTypes.SKIP)
      expect((nestedNode.test as SimpleExpressionNode).content).toBe(
        `_ctx.nested`,
      )
      expect(nestedNode.consequent.type === NodeTypes.JS_CALL_EXPRESSION).toBe(
        true,
      )
      expect(nestedNode.alternate.children.length).toBe(1)
      expect(nestedNode.alternate.children[0].type).toBe(NodeTypes.ELEMENT)
      expect((nestedNode.alternate.children[0] as ElementNode).tag).toBe(`span`)
      expect(generate(root).code).toMatchSnapshot()
    })

    test('v-if + v-skip', () => {
      const { root, node } = parseWithSkipTransform(
        `<div v-if="ok" v-skip="nested"/>`,
      )
      expect(node.type).toBe(NodeTypes.IF)
      const ifNode = node as unknown as IfNode
      const branch = ifNode.branches[0]
      expect((branch.condition as SimpleExpressionNode).content).toBe(`_ctx.ok`)
      expect(branch.children.length).toBe(1)
      // skipNode
      expect(branch.children[0].type).toBe(NodeTypes.SKIP)
      expect(
        ((branch.children[0] as SkipNode).test as SimpleExpressionNode).content,
      ).toBe(`_ctx.nested`)
      expect(generate(root).code).toMatchSnapshot()
    })

    test('v-skip with key', () => {
      const { root, node } = parseWithSkipTransform(
        `<div v-skip="nested" key="foo"/>`,
      )
      expect(node.type).toBe(NodeTypes.SKIP)
      expect((node.test as SimpleExpressionNode).content).toBe(`_ctx.nested`)
      expect(node.consequent.type === NodeTypes.JS_CALL_EXPRESSION).toBe(true)
      expect(node.alternate.children.length).toBe(1)
      expect(node.alternate.children[0].type).toBe(NodeTypes.ELEMENT)
      expect((node.alternate.children[0] as ElementNode).tag).toBe(`div`)
      expect(
        (node.alternate.children[0] as ElementNode).props[0],
      ).toMatchObject({
        name: 'key',
        type: NodeTypes.ATTRIBUTE,
        value: {
          content: 'foo',
        },
      })
      expect(generate(root).code).toMatchSnapshot()
    })

    test('v-else + v-skip', () => {
      const { root, node } = parseWithSkipTransform(
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
      ).toBe(`_ctx.nested`)
      expect(generate(root).code).toMatchSnapshot()
    })

    test('v-else-if + v-skip', () => {
      const { root, node } = parseWithSkipTransform(
        `<div v-if="ok"/><div v-else-if="yes" v-skip="nested"/>`,
      )
      expect(node.type).toBe(NodeTypes.IF)
      const elseIfNode = node as unknown as IfNode
      const branch = elseIfNode.branches[1]
      expect((branch.condition as SimpleExpressionNode).content).toBe(
        `_ctx.yes`,
      )
      expect(branch.children.length).toBe(1)
      // skipNode
      expect(branch.children[0].type).toBe(NodeTypes.SKIP)
      expect(
        ((branch.children[0] as SkipNode).test as SimpleExpressionNode).content,
      ).toBe(`_ctx.nested`)
      expect(generate(root).code).toMatchSnapshot()
    })

    test('on component', () => {
      const { root, node } = parseWithSkipTransform(`<Comp v-skip="ok"/>`)
      expect(node.type).toBe(NodeTypes.SKIP)
      expect((node.test as SimpleExpressionNode).content).toBe(`_ctx.ok`)
      expect(node.consequent.type === NodeTypes.JS_CALL_EXPRESSION).toBe(true)
      expect(node.alternate.children.length).toBe(1)
      expect((node.alternate.children[0] as ElementNode).tagType).toBe(
        ElementTypes.COMPONENT,
      )
      expect((node.alternate.children[0] as ElementNode).tag).toBe(`Comp`)
      expect(generate(root).code).toMatchSnapshot()
    })

    test('on component with default slot', () => {
      const { root, node } = parseWithSkipTransform(
        `<Comp v-skip="ok">foo</Comp>`,
      )
      expect(node.type).toBe(NodeTypes.SKIP)
      expect((node.test as SimpleExpressionNode).content).toBe(`_ctx.ok`)
      expect((node.consequent as IfBranchNode).children.length).toBe(1)
      expect((node.consequent as IfBranchNode).children[0].type).toBe(
        NodeTypes.TEXT,
      )
      expect(
        ((node.consequent as IfBranchNode).children[0] as any).content,
      ).toBe(`foo`)
      expect(node.alternate.children.length).toBe(1)
      expect((node.alternate.children[0] as ElementNode).tagType).toBe(
        ElementTypes.COMPONENT,
      )
      expect((node.alternate.children[0] as ElementNode).tag).toBe(`Comp`)
      expect(generate(root).code).toMatchSnapshot()
    })

    test('on component with multiple named slot', () => {
      const { root, node } = parseWithSkipTransform(
        `<Comp v-skip="ok">
          <template #default>default</template>
          <template #foo>foo</template>
        </Comp>`,
      )
      expect(node.type).toBe(NodeTypes.SKIP)
      expect((node.test as SimpleExpressionNode).content).toBe(`_ctx.ok`)
      expect((node.consequent as IfBranchNode).children.length).toBe(1)
      expect((node.consequent as IfBranchNode).children[0].type).toBe(
        NodeTypes.TEXT,
      )
      expect(
        ((node.consequent as IfBranchNode).children[0] as any).content,
      ).toBe(`default`)
      expect(node.alternate.children.length).toBe(1)
      expect((node.alternate.children[0] as ElementNode).tagType).toBe(
        ElementTypes.COMPONENT,
      )
      expect((node.alternate.children[0] as ElementNode).tag).toBe(`Comp`)
      expect(generate(root).code).toMatchSnapshot()
    })

    test('on component with multiple implicit slot', () => {
      const { root, node } = parseWithSkipTransform(
        `<Comp v-skip="ok">
          <span/>
          <template #foo>foo</template>
          <div/>
        </Comp>`,
      )
      expect(node.type).toBe(NodeTypes.SKIP)
      expect((node.test as SimpleExpressionNode).content).toBe(`_ctx.ok`)
      expect((node.consequent as IfBranchNode).children.length).toBe(2)
      expect((node.consequent as IfBranchNode).children[0].type).toBe(
        NodeTypes.ELEMENT,
      )
      expect(
        ((node.consequent as IfBranchNode).children[0] as ElementNode).tag,
      ).toBe(`span`)
      expect((node.consequent as IfBranchNode).children[1].type).toBe(
        NodeTypes.ELEMENT,
      )
      expect(
        ((node.consequent as IfBranchNode).children[1] as ElementNode).tag,
      ).toBe(`div`)
      expect(node.alternate.children.length).toBe(1)
      expect((node.alternate.children[0] as ElementNode).tagType).toBe(
        ElementTypes.COMPONENT,
      )
      expect((node.alternate.children[0] as ElementNode).tag).toBe(`Comp`)
      expect(generate(root).code).toMatchSnapshot()
    })

    test('on dynamic component', () => {
      const { root, node } = parseWithSkipTransform(
        `<component :is="Comp" v-skip="ok">
          <slot/>
        </component>`,
      )
      expect(node.type).toBe(NodeTypes.SKIP)
      expect((node.test as SimpleExpressionNode).content).toBe(`_ctx.ok`)
      expect((node.consequent as IfBranchNode).children.length).toBe(1)
      expect((node.consequent as IfBranchNode).children[0].type).toBe(
        NodeTypes.ELEMENT,
      )
      expect(
        ((node.consequent as IfBranchNode).children[0] as ElementNode).tag,
      ).toBe(`slot`)
      expect(node.alternate.children.length).toBe(1)
      expect((node.alternate.children[0] as ElementNode).tagType).toBe(
        ElementTypes.COMPONENT,
      )
      expect((node.alternate.children[0] as ElementNode).tag).toBe(`component`)
      expect(generate(root).code).toMatchSnapshot()
    })
  })

  describe('errors', () => {
    test('no expression', () => {
      const onError = vi.fn()
      const { node } = parseWithSkipTransform(`<div v-skip/>`, { onError })
      expect(onError.mock.calls[0]).toMatchObject([
        {
          code: ErrorCodes.X_V_SKIP_NO_EXPRESSION,
          loc: node.loc,
        },
      ])
    })

    test('on <slot>', () => {
      const onError = vi.fn()
      parseWithSkipTransform(`<slot v-skip="ok"/>`, { onError })
      expect(onError.mock.calls[0]).toMatchObject([
        {
          code: ErrorCodes.X_V_SKIP_ON_TEMPLATE,
        },
      ])
    })

    test('on <template>', () => {
      const onError = vi.fn()
      parseWithSkipTransform(`<template v-skip="ok"/>`, { onError })
      expect(onError.mock.calls[0]).toMatchObject([
        {
          code: ErrorCodes.X_V_SKIP_ON_TEMPLATE,
        },
      ])
    })

    test('on component without default slot', () => {
      const onError = vi.fn()
      parseWithSkipTransform(
        `<Comp v-skip="ok">
          <template #foo>foo</template>
        </Comp>`,
        { onError },
      )
      expect(onError.mock.calls[0]).toMatchObject([
        {
          code: ErrorCodes.X_V_SKIP_UNEXPECTED_SLOT,
        },
      ])
    })

    test('with v-for', () => {
      const onError = vi.fn()
      parseWithSkipTransform(`<div v-for="i in items" v-skip="ok"/>`, {
        onError,
      })
      expect(onError.mock.calls[0]).toMatchObject([
        {
          code: ErrorCodes.X_V_SKIP_WITH_V_FOR,
        },
      ])
    })
  })
})
