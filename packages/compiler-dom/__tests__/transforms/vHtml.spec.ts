import {
  parse,
  transform,
  CompilerOptions,
  ElementNode,
  NodeTypes
} from '@vue/compiler-core'
import { transformHtml } from '../../src/transforms/vHtml'

function transformWithStyleTransform(
  template: string,
  options: CompilerOptions = {}
) {
  const ast = parse(template)
  transform(ast, {
    nodeTransforms: [transformHtml],
    ...options
  })
  return {
    root: ast,
    node: ast.children[0] as ElementNode
  }
}

describe('compiler: style transform', () => {
  it('should add `innerHtml` prop', () => {
    const { node } = transformWithStyleTransform(`<div v-html="test"/>`)
    expect(node.props[0]).toMatchObject({
      type: NodeTypes.DIRECTIVE,
      name: `bind`,
      arg: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: `innerHTML`,
        isStatic: true
      },
      exp: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: `test`,
        isStatic: false
      }
    })
  })

  it('should remove all children', () => {
    const { node } = transformWithStyleTransform(
      `<div v-html="test"><p>foo</p><p>bar</p></div>`
    )
    expect(node.children).toHaveLength(0)
    expect(node.props[0]).toMatchObject({
      type: NodeTypes.DIRECTIVE,
      name: `bind`,
      arg: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: `innerHTML`,
        isStatic: true
      },
      exp: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: `test`,
        isStatic: false
      }
    })
  })
})
