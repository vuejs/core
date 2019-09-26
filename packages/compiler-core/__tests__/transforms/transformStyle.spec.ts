import {
  parse,
  transform,
  CompilerOptions,
  ElementNode,
  NodeTypes
} from '../../src'
import { transformStyle } from '../../src/transforms/transformStyle'
import { transformBind } from '../../src/transforms/vBind'
import { transformElement } from '../../src/transforms/transformElement'

function transformWithStyleTransform(
  template: string,
  options: CompilerOptions = {}
) {
  const ast = parse(template)
  transform(ast, {
    nodeTransforms: [transformStyle],
    ...options
  })
  return {
    root: ast,
    node: ast.children[0] as ElementNode
  }
}

describe('compiler: style transform', () => {
  test('should transform into directive node and hoist value', () => {
    const { root, node } = transformWithStyleTransform(
      `<div style="color: red"/>`
    )
    expect(root.hoists).toMatchObject([
      {
        type: NodeTypes.EXPRESSION,
        content: `{"color":"red"}`,
        isStatic: false
      }
    ])
    expect(node.props[0]).toMatchObject({
      type: NodeTypes.DIRECTIVE,
      name: `bind`,
      arg: {
        type: NodeTypes.EXPRESSION,
        content: `style`,
        isStatic: true
      },
      exp: {
        type: NodeTypes.EXPRESSION,
        content: `_hoisted_1`,
        isStatic: false
      }
    })
  })

  test('working with v-bind transform', () => {
    const { node } = transformWithStyleTransform(`<div style="color: red"/>`, {
      nodeTransforms: [transformStyle, transformElement],
      directiveTransforms: {
        bind: transformBind
      }
    })
    expect(node.codegenNode!.arguments[1]).toMatchObject({
      type: NodeTypes.JS_OBJECT_EXPRESSION,
      properties: [
        {
          key: {
            type: NodeTypes.EXPRESSION,
            content: `style`,
            isStatic: true
          },
          value: {
            type: NodeTypes.EXPRESSION,
            content: `_hoisted_1`,
            isStatic: false
          }
        }
      ]
    })
  })
})
