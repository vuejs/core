import { parse } from '../../src/parse'
import { transform } from '../../src/transform'
import { transformIf } from '../../src/transforms/vIf'
import { transformElement } from '../../src/transforms/transformElement'
import { transformSlotOutlet } from '../../src/transforms/transformSlotOutlet'
import {
  IfNode,
  NodeTypes,
  ElementNode,
  TextNode,
  CommentNode,
  SimpleExpressionNode,
  SequenceExpression,
  ConditionalExpression,
  CallExpression
} from '../../src/ast'
import { ErrorCodes } from '../../src/errors'
import { CompilerOptions, generate } from '../../src'
import {
  OPEN_BLOCK,
  CREATE_BLOCK,
  EMPTY,
  FRAGMENT,
  MERGE_PROPS,
  APPLY_DIRECTIVES,
  RENDER_SLOT
} from '../../src/runtimeHelpers'
import { createObjectMatcher } from '../testUtils'

function parseWithIfTransform(
  template: string,
  options: CompilerOptions = {},
  returnIndex: number = 0
) {
  const ast = parse(template, options)
  transform(ast, {
    nodeTransforms: [transformIf, transformSlotOutlet, transformElement],
    ...options
  })
  if (!options.onError) {
    expect(ast.children.length).toBe(1)
    expect(ast.children[0].type).toBe(NodeTypes.IF)
  }
  return {
    root: ast,
    node: ast.children[returnIndex] as IfNode
  }
}

describe('compiler: v-if', () => {
  describe('transform', () => {
    test('basic v-if', () => {
      const { node } = parseWithIfTransform(`<div v-if="ok"/>`)
      expect(node.type).toBe(NodeTypes.IF)
      expect(node.branches.length).toBe(1)
      expect((node.branches[0].condition as SimpleExpressionNode).content).toBe(
        `ok`
      )
      expect(node.branches[0].children.length).toBe(1)
      expect(node.branches[0].children[0].type).toBe(NodeTypes.ELEMENT)
      expect((node.branches[0].children[0] as ElementNode).tag).toBe(`div`)
    })

    test('template v-if', () => {
      const { node } = parseWithIfTransform(
        `<template v-if="ok"><div/>hello<p/></template>`
      )
      expect(node.type).toBe(NodeTypes.IF)
      expect(node.branches.length).toBe(1)
      expect((node.branches[0].condition as SimpleExpressionNode).content).toBe(
        `ok`
      )
      expect(node.branches[0].children.length).toBe(3)
      expect(node.branches[0].children[0].type).toBe(NodeTypes.ELEMENT)
      expect((node.branches[0].children[0] as ElementNode).tag).toBe(`div`)
      expect(node.branches[0].children[1].type).toBe(NodeTypes.TEXT)
      expect((node.branches[0].children[1] as TextNode).content).toBe(`hello`)
      expect(node.branches[0].children[2].type).toBe(NodeTypes.ELEMENT)
      expect((node.branches[0].children[2] as ElementNode).tag).toBe(`p`)
    })

    test('v-if + v-else', () => {
      const { node } = parseWithIfTransform(`<div v-if="ok"/><p v-else/>`)
      expect(node.type).toBe(NodeTypes.IF)
      expect(node.branches.length).toBe(2)

      const b1 = node.branches[0]
      expect((b1.condition as SimpleExpressionNode).content).toBe(`ok`)
      expect(b1.children.length).toBe(1)
      expect(b1.children[0].type).toBe(NodeTypes.ELEMENT)
      expect((b1.children[0] as ElementNode).tag).toBe(`div`)

      const b2 = node.branches[1]
      expect(b2.condition).toBeUndefined()
      expect(b2.children.length).toBe(1)
      expect(b2.children[0].type).toBe(NodeTypes.ELEMENT)
      expect((b2.children[0] as ElementNode).tag).toBe(`p`)
    })

    test('v-if + v-else-if', () => {
      const { node } = parseWithIfTransform(
        `<div v-if="ok"/><p v-else-if="orNot"/>`
      )
      expect(node.type).toBe(NodeTypes.IF)
      expect(node.branches.length).toBe(2)

      const b1 = node.branches[0]
      expect((b1.condition as SimpleExpressionNode).content).toBe(`ok`)
      expect(b1.children.length).toBe(1)
      expect(b1.children[0].type).toBe(NodeTypes.ELEMENT)
      expect((b1.children[0] as ElementNode).tag).toBe(`div`)

      const b2 = node.branches[1]
      expect((b2.condition as SimpleExpressionNode).content).toBe(`orNot`)
      expect(b2.children.length).toBe(1)
      expect(b2.children[0].type).toBe(NodeTypes.ELEMENT)
      expect((b2.children[0] as ElementNode).tag).toBe(`p`)
    })

    test('v-if + v-else-if + v-else', () => {
      const { node } = parseWithIfTransform(
        `<div v-if="ok"/><p v-else-if="orNot"/><template v-else>fine</template>`
      )
      expect(node.type).toBe(NodeTypes.IF)
      expect(node.branches.length).toBe(3)

      const b1 = node.branches[0]
      expect((b1.condition as SimpleExpressionNode).content).toBe(`ok`)
      expect(b1.children.length).toBe(1)
      expect(b1.children[0].type).toBe(NodeTypes.ELEMENT)
      expect((b1.children[0] as ElementNode).tag).toBe(`div`)

      const b2 = node.branches[1]
      expect((b2.condition as SimpleExpressionNode).content).toBe(`orNot`)
      expect(b2.children.length).toBe(1)
      expect(b2.children[0].type).toBe(NodeTypes.ELEMENT)
      expect((b2.children[0] as ElementNode).tag).toBe(`p`)

      const b3 = node.branches[2]
      expect(b3.condition).toBeUndefined()
      expect(b3.children.length).toBe(1)
      expect(b3.children[0].type).toBe(NodeTypes.TEXT)
      expect((b3.children[0] as TextNode).content).toBe(`fine`)
    })

    test('comment between branches', () => {
      const { node } = parseWithIfTransform(`
        <div v-if="ok"/>
        <!--foo-->
        <p v-else-if="orNot"/>
        <!--bar-->
        <template v-else>fine</template>
      `)
      expect(node.type).toBe(NodeTypes.IF)
      expect(node.branches.length).toBe(3)

      const b1 = node.branches[0]
      expect((b1.condition as SimpleExpressionNode).content).toBe(`ok`)
      expect(b1.children.length).toBe(1)
      expect(b1.children[0].type).toBe(NodeTypes.ELEMENT)
      expect((b1.children[0] as ElementNode).tag).toBe(`div`)

      const b2 = node.branches[1]
      expect((b2.condition as SimpleExpressionNode).content).toBe(`orNot`)
      expect(b2.children.length).toBe(2)
      expect(b2.children[0].type).toBe(NodeTypes.COMMENT)
      expect((b2.children[0] as CommentNode).content).toBe(`foo`)
      expect(b2.children[1].type).toBe(NodeTypes.ELEMENT)
      expect((b2.children[1] as ElementNode).tag).toBe(`p`)

      const b3 = node.branches[2]
      expect(b3.condition).toBeUndefined()
      expect(b3.children.length).toBe(2)
      expect(b3.children[0].type).toBe(NodeTypes.COMMENT)
      expect((b3.children[0] as CommentNode).content).toBe(`bar`)
      expect(b3.children[1].type).toBe(NodeTypes.TEXT)
      expect((b3.children[1] as TextNode).content).toBe(`fine`)
    })

    test('should prefix v-if condition', () => {
      const { node } = parseWithIfTransform(`<div v-if="ok"/>`, {
        prefixIdentifiers: true
      })
      expect(node.branches[0].condition).toMatchObject({
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: `_ctx.ok`
      })
    })
  })

  describe('errors', () => {
    test('error on v-else missing adjacent v-if', () => {
      const onError = jest.fn()

      const { node: node1 } = parseWithIfTransform(`<div v-else/>`, { onError })
      expect(onError.mock.calls[0]).toMatchObject([
        {
          code: ErrorCodes.X_ELSE_NO_ADJACENT_IF,
          loc: node1.loc
        }
      ])

      const { node: node2 } = parseWithIfTransform(
        `<div/><div v-else/>`,
        { onError },
        1
      )
      expect(onError.mock.calls[1]).toMatchObject([
        {
          code: ErrorCodes.X_ELSE_NO_ADJACENT_IF,
          loc: node2.loc
        }
      ])

      const { node: node3 } = parseWithIfTransform(
        `<div/>foo<div v-else/>`,
        { onError },
        2
      )
      expect(onError.mock.calls[2]).toMatchObject([
        {
          code: ErrorCodes.X_ELSE_NO_ADJACENT_IF,
          loc: node3.loc
        }
      ])
    })

    test('error on v-else-if missing adjacent v-if', () => {
      const onError = jest.fn()

      const { node: node1 } = parseWithIfTransform(`<div v-else-if="foo"/>`, {
        onError
      })
      expect(onError.mock.calls[0]).toMatchObject([
        {
          code: ErrorCodes.X_ELSE_NO_ADJACENT_IF,
          loc: node1.loc
        }
      ])

      const { node: node2 } = parseWithIfTransform(
        `<div/><div v-else-if="foo"/>`,
        { onError },
        1
      )
      expect(onError.mock.calls[1]).toMatchObject([
        {
          code: ErrorCodes.X_ELSE_NO_ADJACENT_IF,
          loc: node2.loc
        }
      ])

      const { node: node3 } = parseWithIfTransform(
        `<div/>foo<div v-else-if="foo"/>`,
        { onError },
        2
      )
      expect(onError.mock.calls[2]).toMatchObject([
        {
          code: ErrorCodes.X_ELSE_NO_ADJACENT_IF,
          loc: node3.loc
        }
      ])
    })
  })

  describe('codegen', () => {
    function assertSharedCodegen(node: SequenceExpression, depth: number = 0) {
      expect(node).toMatchObject({
        type: NodeTypes.JS_SEQUENCE_EXPRESSION,
        expressions: [
          {
            type: NodeTypes.JS_CALL_EXPRESSION,
            callee: OPEN_BLOCK,
            arguments: []
          },
          {
            type: NodeTypes.JS_CONDITIONAL_EXPRESSION,
            test: {
              content: `ok`
            },
            consequent: {
              type: NodeTypes.JS_CALL_EXPRESSION,
              callee: CREATE_BLOCK
            },
            alternate:
              depth < 1
                ? {
                    type: NodeTypes.JS_CALL_EXPRESSION,
                    callee: CREATE_BLOCK
                  }
                : {
                    type: NodeTypes.JS_CONDITIONAL_EXPRESSION,
                    test: {
                      content: `orNot`
                    },
                    consequent: {
                      type: NodeTypes.JS_CALL_EXPRESSION,
                      callee: CREATE_BLOCK
                    },
                    alternate: {
                      type: NodeTypes.JS_CALL_EXPRESSION,
                      callee: CREATE_BLOCK
                    }
                  }
          }
        ]
      })
    }

    test('basic v-if', () => {
      const {
        root,
        node: { codegenNode }
      } = parseWithIfTransform(`<div v-if="ok"/>`)
      assertSharedCodegen(codegenNode)
      const branch1 = (codegenNode.expressions[1] as ConditionalExpression)
        .consequent as CallExpression
      expect(branch1.arguments).toMatchObject([
        `"div"`,
        createObjectMatcher({ key: `[0]` })
      ])
      const branch2 = (codegenNode.expressions[1] as ConditionalExpression)
        .alternate as CallExpression
      expect(branch2.arguments).toMatchObject([EMPTY])
      expect(generate(root).code).toMatchSnapshot()
    })

    test('template v-if', () => {
      const {
        root,
        node: { codegenNode }
      } = parseWithIfTransform(`<template v-if="ok"><div/>hello<p/></template>`)
      assertSharedCodegen(codegenNode)
      const branch1 = (codegenNode.expressions[1] as ConditionalExpression)
        .consequent as CallExpression
      expect(branch1.arguments).toMatchObject([
        FRAGMENT,
        createObjectMatcher({ key: `[0]` }),
        [
          { type: NodeTypes.ELEMENT, tag: 'div' },
          { type: NodeTypes.TEXT, content: `hello` },
          { type: NodeTypes.ELEMENT, tag: 'p' }
        ]
      ])
      const branch2 = (codegenNode.expressions[1] as ConditionalExpression)
        .alternate as CallExpression
      expect(branch2.arguments).toMatchObject([EMPTY])
      expect(generate(root).code).toMatchSnapshot()
    })

    test('template v-if w/ single <slot/> child', () => {
      const {
        root,
        node: { codegenNode }
      } = parseWithIfTransform(`<template v-if="ok"><slot/></template>`)
      // assertSharedCodegen(codegenNode)
      const branch1 = (codegenNode.expressions[1] as ConditionalExpression)
        .consequent as CallExpression
      expect(branch1).toMatchObject({
        type: NodeTypes.JS_CALL_EXPRESSION,
        callee: RENDER_SLOT,
        arguments: ['$slots', '"default"', createObjectMatcher({ key: `[0]` })]
      })
      expect(generate(root).code).toMatchSnapshot()
    })

    test('v-if on <slot/>', () => {
      const {
        root,
        node: { codegenNode }
      } = parseWithIfTransform(`<slot v-if="ok"></slot>`)
      // assertSharedCodegen(codegenNode)
      const branch1 = (codegenNode.expressions[1] as ConditionalExpression)
        .consequent as CallExpression
      expect(branch1).toMatchObject({
        type: NodeTypes.JS_CALL_EXPRESSION,
        callee: RENDER_SLOT,
        arguments: ['$slots', '"default"', createObjectMatcher({ key: `[0]` })]
      })
      expect(generate(root).code).toMatchSnapshot()
    })

    test('v-if + v-else', () => {
      const {
        root,
        node: { codegenNode }
      } = parseWithIfTransform(`<div v-if="ok"/><p v-else/>`)
      assertSharedCodegen(codegenNode)
      const branch1 = (codegenNode.expressions[1] as ConditionalExpression)
        .consequent as CallExpression
      expect(branch1.arguments).toMatchObject([
        `"div"`,
        createObjectMatcher({ key: `[0]` })
      ])
      const branch2 = (codegenNode.expressions[1] as ConditionalExpression)
        .alternate as CallExpression
      expect(branch2.arguments).toMatchObject([
        `"p"`,
        createObjectMatcher({ key: `[1]` })
      ])
      expect(generate(root).code).toMatchSnapshot()
    })

    test('v-if + v-else-if', () => {
      const {
        root,
        node: { codegenNode }
      } = parseWithIfTransform(`<div v-if="ok"/><p v-else-if="orNot" />`)
      assertSharedCodegen(codegenNode, 1)
      const branch1 = (codegenNode.expressions[1] as ConditionalExpression)
        .consequent as CallExpression
      expect(branch1.arguments).toMatchObject([
        `"div"`,
        createObjectMatcher({ key: `[0]` })
      ])
      const branch2 = (codegenNode.expressions[1] as ConditionalExpression)
        .alternate as ConditionalExpression
      expect((branch2.consequent as CallExpression).arguments).toMatchObject([
        `"p"`,
        createObjectMatcher({ key: `[1]` })
      ])
      expect(generate(root).code).toMatchSnapshot()
    })

    test('v-if + v-else-if + v-else', () => {
      const {
        root,
        node: { codegenNode }
      } = parseWithIfTransform(
        `<div v-if="ok"/><p v-else-if="orNot"/><template v-else>fine</template>`
      )
      assertSharedCodegen(codegenNode, 1)
      const branch1 = (codegenNode.expressions[1] as ConditionalExpression)
        .consequent as CallExpression
      expect(branch1.arguments).toMatchObject([
        `"div"`,
        createObjectMatcher({ key: `[0]` })
      ])
      const branch2 = (codegenNode.expressions[1] as ConditionalExpression)
        .alternate as ConditionalExpression
      expect((branch2.consequent as CallExpression).arguments).toMatchObject([
        `"p"`,
        createObjectMatcher({ key: `[1]` })
      ])
      expect((branch2.alternate as CallExpression).arguments).toMatchObject([
        FRAGMENT,
        createObjectMatcher({ key: `[2]` }),
        [
          {
            type: NodeTypes.TEXT,
            content: `fine`
          }
        ]
      ])
      expect(generate(root).code).toMatchSnapshot()
    })

    test('key injection (only v-bind)', () => {
      const {
        node: { codegenNode }
      } = parseWithIfTransform(`<div v-if="ok" v-bind="obj"/>`)
      const branch1 = (codegenNode.expressions[1] as ConditionalExpression)
        .consequent as CallExpression
      expect(branch1.arguments[1]).toMatchObject({
        type: NodeTypes.JS_CALL_EXPRESSION,
        callee: MERGE_PROPS,
        arguments: [createObjectMatcher({ key: `[0]` }), { content: `obj` }]
      })
    })

    test('key injection (before v-bind)', () => {
      const {
        node: { codegenNode }
      } = parseWithIfTransform(`<div v-if="ok" id="foo" v-bind="obj"/>`)
      const branch1 = (codegenNode.expressions[1] as ConditionalExpression)
        .consequent as CallExpression
      expect(branch1.arguments[1]).toMatchObject({
        type: NodeTypes.JS_CALL_EXPRESSION,
        callee: MERGE_PROPS,
        arguments: [
          createObjectMatcher({
            key: '[0]',
            id: 'foo'
          }),
          { content: `obj` }
        ]
      })
    })

    test('key injection (after v-bind)', () => {
      const {
        node: { codegenNode }
      } = parseWithIfTransform(`<div v-if="ok" v-bind="obj" id="foo"/>`)
      const branch1 = (codegenNode.expressions[1] as ConditionalExpression)
        .consequent as CallExpression
      expect(branch1.arguments[1]).toMatchObject({
        type: NodeTypes.JS_CALL_EXPRESSION,
        callee: MERGE_PROPS,
        arguments: [
          createObjectMatcher({ key: `[0]` }),
          { content: `obj` },
          createObjectMatcher({
            id: 'foo'
          })
        ]
      })
    })

    test('key injection (w/ custom directive)', () => {
      const {
        node: { codegenNode }
      } = parseWithIfTransform(`<div v-if="ok" v-foo />`)
      const branch1 = (codegenNode.expressions[1] as ConditionalExpression)
        .consequent as CallExpression
      expect(branch1.callee).toBe(APPLY_DIRECTIVES)
      const realBranch = branch1.arguments[0] as CallExpression
      expect(realBranch.arguments[1]).toMatchObject(
        createObjectMatcher({ key: `[0]` })
      )
    })

    test.todo('with comments')
  })
})
