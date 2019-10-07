import {
  parse,
  transform,
  CompilerOptions,
  ElementNode,
  NodeTypes,
  createObjectExpression,
  createObjectProperty,
  createSimpleExpression
} from '@vue/compiler-core'
import { transformShow } from '../../src/transforms/vShow'
import { transformStyle } from '../../src/transforms/transformStyle'

function parseWithShowTransform(
  template: string,
  options: CompilerOptions = {}
) {
  const ast = parse(template, options)
  transform(ast, {
    nodeTransforms: [
      transformStyle,
      // NOTE: transformShow must come come after the style
      transformShow
    ],
    ...options
  })
  return {
    root: ast,
    node: ast.children[0] as ElementNode
  }
}

describe('compiler: `v-show` transform', () => {
  it('should add style directive', () => {
    const { node } = parseWithShowTransform(`<div v-show="true"/>`)

    expect(node.props[0]).toMatchObject({
      type: NodeTypes.DIRECTIVE,
      name: `bind`,
      arg: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: `style`,
        isStatic: true
      },
      exp: {
        type: NodeTypes.COMPOUND_EXPRESSION,
        children: [
          {
            type: NodeTypes.SIMPLE_EXPRESSION,
            isStatic: false,
            content: 'true'
          },
          "?",
          createObjectExpression([
            createObjectProperty('display', createSimpleExpression('none', true))
          ]),
          ":",
          createObjectExpression([])
        ]
      }
    })
  })

  describe('style', () => {
    it('should append to style', () => {
      const { node } = parseWithShowTransform(
        `<div style="display:flex" v-show="true"/>`
      )

      expect(node.props).toMatchObject([
        {
          type: NodeTypes.DIRECTIVE,
          name: `bind`,
          arg: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: `style`,
            isStatic: true
          },
          exp: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: `_hoisted_1`,
            isStatic: false
          }
        },
        {
          type: NodeTypes.DIRECTIVE,
          name: `bind`,
          arg: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: `style`,
            isStatic: true
          },
          exp: {
            type: NodeTypes.COMPOUND_EXPRESSION,
            children: [
              {
                type: NodeTypes.SIMPLE_EXPRESSION,
                isStatic: false,
                content: 'true'
              },
              "?",
              createObjectExpression([
                createObjectProperty('display', createSimpleExpression('none', true))
              ]),
              ":",
              createObjectExpression([])
            ]
          }
        }
      ])
    })
  })
})
