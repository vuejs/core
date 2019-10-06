import {
  parse,
  transform,
  CompilerOptions,
  ElementNode,
  NodeTypes
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
  it('should add style directive and hoist value', () => {
    const { root, node } = parseWithShowTransform(`<div v-show="true"/>`)
    expect(root.hoists).toMatchObject([
      {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: `{"display":"none"}`,
        isStatic: false
      },
      {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: `{}`,
        isStatic: false
      }
    ])
    expect(node.props[0]).toMatchObject({
      type: NodeTypes.DIRECTIVE,
      name: `bind`,
      arg: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: `style`,
        isStatic: true
      },
      exp: {
        type: NodeTypes.JS_CONDITIONAL_EXPRESSION,
        test: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          isStatic: false,
          content: 'true'
        },
        consequent: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: '_hoisted_1',
          isStatic: false
        },
        alternate: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: '_hoisted_2',
          isStatic: false
        }
      }
    })
  })

  describe('style', () => {
    it('should append to style', () => {
      const { root, node } = parseWithShowTransform(
        `<div style="display:flex" v-show="true"/>`
      )

      expect(root.hoists).toMatchObject([
        {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: `{"display":"flex"}`,
          isStatic: false
        },
        {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: `{"display":"none"}`,
          isStatic: false
        },
        {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: `{}`,
          isStatic: false
        }
      ])
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
            type: NodeTypes.JS_CONDITIONAL_EXPRESSION,
            test: {
              type: NodeTypes.SIMPLE_EXPRESSION,
              isStatic: false,
              content: 'true'
            },
            consequent: {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: '_hoisted_2',
              isStatic: false
            },
            alternate: {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: '_hoisted_3',
              isStatic: false
            }
          }
        }
      ])
    })

    it('should append to style even if is the first directive', () => {
      const { root, node } = parseWithShowTransform(
        `<div v-show="true" style="display:flex"/>`
      )

      expect(root.hoists).toMatchObject([
        {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: `{"display":"flex"}`,
          isStatic: false
        },
        {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: `{"display":"none"}`,
          isStatic: false
        },
        {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: `{}`,
          isStatic: false
        }
      ])
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
            type: NodeTypes.JS_CONDITIONAL_EXPRESSION,
            test: {
              type: NodeTypes.SIMPLE_EXPRESSION,
              isStatic: false,
              content: 'true'
            },
            consequent: {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: '_hoisted_2',
              isStatic: false
            },
            alternate: {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: '_hoisted_3',
              isStatic: false
            }
          }
        }
      ])
    })
  })

  // test('working with v-bind transform', () => {
  //   const { node } = transformWithStyleTransform(`<div style="color: red"/>`, {
  //     nodeTransforms: [transformStyle, transformElement],
  //     directiveTransforms: {
  //       bind: transformBind
  //     }
  //   })
  //   expect((node.codegenNode as CallExpression).arguments[1]).toMatchObject({
  //     type: NodeTypes.JS_OBJECT_EXPRESSION,
  //     properties: [
  //       {
  //         key: {
  //           type: NodeTypes.SIMPLE_EXPRESSION,
  //           content: `style`,
  //           isStatic: true
  //         },
  //         value: {
  //           type: NodeTypes.SIMPLE_EXPRESSION,
  //           content: `_hoisted_1`,
  //           isStatic: false
  //         }
  //       }
  //     ]
  //   })
  // })
})
