import {
  baseParse as parse,
  transform,
  CompilerOptions,
  ElementNode,
  NodeTypes,
  VNodeCall,
  NORMALIZE_STYLE
} from '@vue/compiler-core'
import { transformBind } from '../../../compiler-core/src/transforms/vBind'
import { transformElement } from '../../../compiler-core/src/transforms/transformElement'
import { transformStyle } from '../../src/transforms/transformStyle'

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
  test('should transform into directive node', () => {
    const { node } = transformWithStyleTransform(`<div style="color: red"/>`)
    expect(node.props[0]).toMatchObject({
      type: NodeTypes.DIRECTIVE,
      name: `bind`,
      arg: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: `style`,
        isStatic: true
      },
      exp: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: `{"color":"red"}`,
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
    expect((node.codegenNode as VNodeCall).props).toMatchObject({
      type: NodeTypes.JS_OBJECT_EXPRESSION,
      properties: [
        {
          key: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: `style`,
            isStatic: true
          },
          value: {
            type: NodeTypes.JS_CALL_EXPRESSION,
            callee: NORMALIZE_STYLE,
            arguments: [
              {
                type: NodeTypes.SIMPLE_EXPRESSION,
                content: `{"color":"red"}`,
                isStatic: false
              }
            ]
          }
        }
      ]
    })
    // should not cause the STYLE patchFlag to be attached
    expect((node.codegenNode as VNodeCall).patchFlag).toBeUndefined()
  })
})
